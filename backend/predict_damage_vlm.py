import os
import sys
import json
import time
import base64
import argparse
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import requests


# =========================
# HARD-CODED CONFIG (per your request)
# =========================
NVIDIA_API_KEY = "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"  # <-- paste your NVIDIA key here
NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"
DEFAULT_MODEL = "qwen/qwen3.5-397b-a17b"

# Your note: 40 req/min => 60/40 = 1.5s between requests
REQS_PER_MINUTE = 40
MIN_SECONDS_BETWEEN_CALLS = 60.0 / REQS_PER_MINUTE


# =========================
# Helpers
# =========================
DAMAGE_LABELS = ["no-damage", "minor-damage", "major-damage", "destroyed"]

def now_ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S")

def ensure_dir(p: str) -> None:
    os.makedirs(p, exist_ok=True)

def read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path: str, obj: dict) -> None:
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)

def b64_data_url_from_image(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    mime = "image/jpeg" if ext in [".jpg", ".jpeg"] else "image/png"
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"

def normalize_label(raw: str) -> str:
    r = (raw or "").strip().lower()
    # common aliases
    r = r.replace("_", "-").replace(" ", "-")
    if r in DAMAGE_LABELS:
        return r
    # handle "major damage" etc
    if "no" in r and "damage" in r:
        return "no-damage"
    if "minor" in r:
        return "minor-damage"
    if "major" in r:
        return "major-damage"
    if "destroy" in r:
        return "destroyed"
    return "ERROR"

def extract_expected_map(labels_json: dict) -> Dict[str, str]:
    """
    Your example is:
    { "features": { "xy": [ { "properties": { "uid": "...", "subtype": "minor-damage" }, ... }, ... ] } }
    We'll accept either features.xy or features.lng_lat.
    """
    feats = labels_json.get("features", {})
    items = feats.get("xy") or feats.get("lng_lat") or []
    exp = {}
    for it in items:
        props = it.get("properties", {})
        uid = props.get("uid")
        subtype = props.get("subtype")
        if uid and subtype:
            exp[uid] = normalize_label(subtype)
    return exp


# =========================
# NVIDIA client (OpenAI-style)
# =========================
@dataclass
class NvidiaChatClient:
    api_key: str
    base_url: str = NVIDIA_BASE_URL
    timeout_s: int = 90

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def chat_completion_multimodal(self, model: str, prompt: str, image_data_url: str,
                                   temperature: float = 0.0, max_tokens: int = 64) -> Tuple[int, dict]:
        """
        Attempt #1: OpenAI multimodal format with content as an array:
          content: [{type:"text", text:"..."}, {type:"image_url", image_url:{url:"data:..."}}]

        If the endpoint rejects this schema, we fall back to Attempt #2 where content is a string
        and we attach the image via a nonstandard field (some providers do this).
        """
        url = f"{self.base_url}/chat/completions"

        payload_v1 = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_data_url}},
                    ],
                }
            ],
        }

        r = requests.post(url, headers=self._headers(), json=payload_v1, timeout=self.timeout_s)
        if r.status_code < 400:
            return r.status_code, r.json()

        # Attempt #2 (fallback): content as string + attach images in a provider-specific field.
        # If NVIDIA doesn't support it, you still get a clean error we can inspect.
        payload_v2 = {
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
            "images": [image_data_url],  # fallback field
        }

        r2 = requests.post(url, headers=self._headers(), json=payload_v2, timeout=self.timeout_s)
        try:
            j2 = r2.json()
        except Exception:
            j2 = {"raw_text": r2.text}
        return r2.status_code, j2


def parse_model_label(resp_json: dict) -> str:
    """
    Expect OpenAI-like response:
      resp["choices"][0]["message"]["content"] -> model text
    We'll extract the first recognized label.
    """
    try:
        content = resp_json["choices"][0]["message"]["content"]
    except Exception:
        return "ERROR"

    text = (content or "").strip()
    # Make it robust: find first known label occurrence
    low = text.lower().replace("_", "-").replace(" ", "-")
    for lab in DAMAGE_LABELS:
        if lab in low:
            return lab
    # If model returned just one word / variant
    return normalize_label(text)


# =========================
# Main pipeline
# =========================
def build_prompt(expected_hint: Optional[str] = None) -> str:
    # You asked to leverage FEMA context; keep prompt tight and label-constrained.
    # IMPORTANT: force the model to answer only with one label.
    hint_line = f"\nExpected label (for reference): {expected_hint}\n" if expected_hint else ""
    return (
        "You are assessing FEMA-style post-disaster building damage from an overhead crop.\n"
        "Classify the building damage into exactly ONE of these labels:\n"
        "- no-damage\n"
        "- minor-damage\n"
        "- major-damage\n"
        "- destroyed\n"
        "Return ONLY the label text, nothing else."
        f"{hint_line}"
    )

def find_crop_for_uid(crop_dir: str, uid: str) -> Optional[str]:
    exts = [".jpg", ".jpeg", ".png"]

    # common patterns
    candidates = []
    for ext in exts:
        candidates += [
            os.path.join(crop_dir, f"{uid}{ext}"),
            os.path.join(crop_dir, f"crop_{uid}{ext}"),
            os.path.join(crop_dir, f"{uid}_post{ext}"),
            os.path.join(crop_dir, f"{uid}_POST{ext}"),
        ]
    for p in candidates:
        if os.path.isfile(p):
            return p

    # fallback scan: find any image filename containing the uid
    for name in os.listdir(crop_dir):
        low = name.lower()
        if not any(low.endswith(ext) for ext in exts):
            continue
        if uid in name:
            p = os.path.join(crop_dir, name)
            if os.path.isfile(p):
                return p
    return None

def run_predictions(
    crop_dir: str,
    labels_json_path: str,
    out_dir: str,
    model: str,
) -> int:
    labels = read_json(labels_json_path)
    expected = extract_expected_map(labels)

    if not expected:
        print(f"[FATAL] Could not find any expected labels in: {labels_json_path}")
        return 2

    client = NvidiaChatClient(api_key=NVIDIA_API_KEY)

    ensure_dir(out_dir)
    pred_items = []
    n = 0
    correct = 0

    last_call_t = 0.0

    uids = sorted(expected.keys())
    total = len(uids)

    for i, uid in enumerate(uids, start=1):
        exp = expected.get(uid, "ERROR")
        crop_path = find_crop_for_uid(crop_dir, uid)

        if not crop_path:
            print(f"[{i}/{total}] UID={uid} ... ERR status=-2 pred=ERROR exp={exp} match=False (missing crop)")
            pred_items.append({
                "uid": uid,
                "expected": exp,
                "predicted": "ERROR",
                "match": False,
                "status": -2,
                "error": "missing_crop",
            })
            continue

        # rate-limit (40/min)
        elapsed = time.time() - last_call_t
        if last_call_t > 0 and elapsed < MIN_SECONDS_BETWEEN_CALLS:
            time.sleep(MIN_SECONDS_BETWEEN_CALLS - elapsed)

        img_url = b64_data_url_from_image(crop_path)
        prompt = build_prompt(expected_hint=None)  # keep clean; don't leak label during scoring

        try:
            status, resp = client.chat_completion_multimodal(model=model, prompt=prompt, image_data_url=img_url)
            last_call_t = time.time()
            pred = parse_model_label(resp) if status < 400 else "ERROR"

            match = (pred == exp)
            n += 1
            if match:
                correct += 1

            if status >= 400:
                err_preview = ""
                try:
                    err_preview = json.dumps(resp)[:180]
                except Exception:
                    err_preview = str(resp)[:180]
                print(f"[{i}/{total}] UID={uid} ... ERR status={status} pred=ERROR exp={exp} match=False api_err={err_preview}")
            else:
                print(f"[{i}/{total}] UID={uid} ... OK  status={status} pred={pred} exp={exp} match={match}")

            pred_items.append({
                "uid": uid,
                "crop_path": crop_path,
                "expected": exp,
                "predicted": pred,
                "match": match,
                "status": status,
                "model": model,
            })

        except requests.exceptions.RequestException as e:
            print(f"[{i}/{total}] UID={uid} ... ERR status=-1 pred=ERROR exp={exp} match=False req_exc={type(e).__name__}:{e}")
            pred_items.append({
                "uid": uid,
                "crop_path": crop_path,
                "expected": exp,
                "predicted": "ERROR",
                "match": False,
                "status": -1,
                "error": f"{type(e).__name__}: {e}",
                "model": model,
            })

    accuracy = (correct / n) if n else 0.0

    # Output JSON in a clean “damage naming” format
    out_json = {
        "metadata": {
            "generated_at": now_ts(),
            "model": model,
            "crop_dir": crop_dir,
            "labels_json_path": labels_json_path,
            "rate_limit_rpm": REQS_PER_MINUTE,
        },
        "results": pred_items,
        "summary": {
            "attempted": n,
            "correct": correct,
            "accuracy": accuracy,
        },
    }

    out_path = os.path.join(out_dir, "predictions.json")
    write_json(out_path, out_json)

    # CSV (simple)
    csv_path = os.path.join(out_dir, "predictions.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("uid,expected,predicted,match,status,crop_path\n")
        for r in pred_items:
            f.write(
                f"{r.get('uid','')},{r.get('expected','')},{r.get('predicted','')},"
                f"{r.get('match','')},{r.get('status','')},\"{r.get('crop_path','')}\"\n"
            )

    print("\n=== SUMMARY ===")
    print(f"attempted={n} correct={correct} accuracy={accuracy:.3f}")
    print(f"Wrote: {out_path}")
    print(f"Wrote: {csv_path}")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--crop_dir", required=True, help="Folder containing PNG crops for a single image id (e.g., 00000003).")
    ap.add_argument("--labels_json", required=True, help="Local path to the labels JSON (the one like your example).")
    ap.add_argument("--out_dir", required=True, help="Where to write predictions.json and predictions.csv")
    ap.add_argument("--model", default=DEFAULT_MODEL, help="NVIDIA model name (default: qwen/qwen3.5-397b-a17b)")
    args = ap.parse_args()

    if NVIDIA_API_KEY.strip() == "PASTE_YOUR_KEY_HERE":
        print("[FATAL] Paste your NVIDIA_API_KEY into the script first.")
        sys.exit(2)

    sys.exit(run_predictions(
        crop_dir=args.crop_dir,
        labels_json_path=args.labels_json,
        out_dir=args.out_dir,
        model=args.model,
    ))


if __name__ == "__main__":
    main()