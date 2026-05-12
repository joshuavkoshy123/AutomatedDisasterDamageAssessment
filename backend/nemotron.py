

import os
import re
import json
import time
import base64
import argparse
import csv
from pathlib import Path
from collections import Counter
from typing import Dict, Tuple, Optional, List, NamedTuple, Any

import requests
from dotenv import load_dotenv

load_dotenv()

# =========================
# USER CONFIG (hardcode)
# =========================
NIM_API_KEY = os.getenv("NVIDIA_API_KEY", "")


INVOKE_URL = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "nvidia/nemotron-nano-12b-v2-vl"


RPM_LIMIT = 40
MIN_INTERVAL_S = 60.0 / RPM_LIMIT

# Network behavior (timeouts + retries)
CONNECT_TIMEOUT_S = 10
READ_TIMEOUT_S = 5  
MAX_RETRIES = 3
RETRY_BACKOFF_S = 2.0

# Labels we will output
ALLOWED = ["no-damage", "minor-damage", "major-damage", "destroyed"]


SYSTEM_PROMPT = "/no_think"
REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RESULTS_CSV = REPO_ROOT / "building_crops" / "_predictions" / "results.csv"
DEFAULT_STATS_JSON = REPO_ROOT / "building_crops" / "_predictions" / "stats.json"

# =========================
# Helpers
# =========================
def die(msg: str, code: int = 1):
    raise SystemExit(f"ERROR: {msg}")

def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def write_json(path: Path, obj: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)
    tmp.replace(path)

def ensure_dir(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def base64_data_url(image_path: Path) -> str:
    
    ext = image_path.suffix.lower().lstrip(".")
    mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }.get(ext)
    if not mime:
        die(f"Unsupported image extension: {image_path.name}")

    b = image_path.read_bytes()
    enc = base64.b64encode(b).decode("utf-8")
    return f"data:{mime};base64,{enc}"

def normalize_label(s: str) -> Optional[str]:
    if not s:
        return None
    s = s.strip().lower()
    s = s.replace("_", "-").replace(" ", "-")
    # common variants
    s = s.replace("nodamage", "no-damage")
    s = s.replace("minor", "minor-damage") if s == "minor" else s
    s = s.replace("major", "major-damage") if s == "major" else s
    s = s.replace("destroy", "destroyed") if s == "destroy" else s
    s = s.replace("destroyed-damage", "destroyed")
    s = s.replace("severe", "destroyed") if s == "severe" else s
    s = s.replace("severe-damage", "destroyed")
    return s if s in ALLOWED else None

def extract_json_from_text(text: str) -> Optional[dict]:
    """
    Try to parse a JSON object embedded in the model response.
    We look for the first {...} block and attempt json.loads.
    """
    if not text:
        return None
    
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    block = m.group(0)
    try:
        return json.loads(block)
    except Exception:
        return None


def normalize_damage_present(value: Any) -> Optional[bool]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in {"yes", "true", "1", "damage", "present"}:
        return True
    if s in {"no", "false", "0", "no-damage", "none", "absent"}:
        return False
    return None


def normalize_impact_level(value: Any) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip().lower().replace("_", "-").replace(" ", "-")
    mapping = {
        "none": "none",
        "no": "none",
        "no-impact": "none",
        "limited": "limited",
        "minor": "limited",
        "low": "limited",
        "serious": "serious",
        "severe": "serious",
        "major": "serious",
        "high": "serious",
    }
    return mapping.get(s)


def evidence_is_weak(value: Any) -> bool:
    if value is None:
        return True
    text = str(value).strip().lower()
    if not text:
        return True

    weak_markers = {
        "unclear",
        "unknown",
        "ambiguous",
        "possible",
        "maybe",
        "cannot tell",
        "hard to tell",
        "low confidence",
        "none",
        "n/a",
    }
    return text in weak_markers

def coerce_uid(s: str) -> str:
    return s.strip()


def maybe_float(value: str) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def extract_scene_id(path_str: str) -> Optional[str]:
    if not path_str:
        return None
    match = re.search(r"(hurricane-harvey_\d+)", path_str.replace("\\", "/"))
    return match.group(1) if match else None


def read_results_csv(csv_path: Path) -> List[dict]:
    if not csv_path.exists():
        return []

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def load_existing_run_state(csv_path: Path) -> Tuple[set[str], Dict[str, str], int, int]:
    done_uids: set[str] = set()
    uid_to_pred: Dict[str, str] = {}
    correct = 0
    evaluated = 0

    rows = read_results_csv(csv_path)
    for row in rows:
        uid = coerce_uid(row.get("uid", ""))
        if not uid:
            continue
        predicted = normalize_label(row.get("predicted", "")) or row.get("predicted", "").strip()
        expected = normalize_label(row.get("expected", "")) or row.get("expected", "").strip()
        match = str(row.get("match", "")).strip().lower() == "true"

        done_uids.add(uid)
        if predicted:
            uid_to_pred[uid] = predicted
        if expected and expected != "UNKNOWN" and predicted and predicted != "ERROR":
            evaluated += 1
            if match:
                correct += 1

    return done_uids, uid_to_pred, correct, evaluated


def read_stats_json(stats_path: Path) -> dict:
    if not stats_path.exists():
        return {}
    return read_json(stats_path)


def build_assessment_summary(rows: List[dict], stats: dict) -> dict:
    predicted_counts: Counter[str] = Counter()
    expected_counts: Counter[str] = Counter()
    scene_counts: Dict[str, Counter[str]] = {}
    mismatches: List[dict] = []
    rows_by_uid: Dict[str, dict] = {}

    for row in rows:
        uid = coerce_uid(row.get("uid", ""))
        if not uid:
            continue

        predicted = normalize_label(row.get("predicted", "")) or row.get("predicted", "").strip().lower() or "unknown"
        expected = normalize_label(row.get("expected", "")) or row.get("expected", "").strip().lower() or "unknown"
        scene_id = extract_scene_id(row.get("pre_path", "")) or extract_scene_id(row.get("post_path", ""))
        latency = maybe_float(row.get("latency_s", ""))
        match = str(row.get("match", "")).strip().lower() == "true"

        row_copy = dict(row)
        row_copy["uid"] = uid
        row_copy["predicted"] = predicted
        row_copy["expected"] = expected
        row_copy["scene_id"] = scene_id
        row_copy["latency_s"] = latency
        row_copy["match"] = match
        rows_by_uid[uid] = row_copy

        predicted_counts[predicted] += 1
        expected_counts[expected] += 1
        if scene_id:
            scene_counts.setdefault(scene_id, Counter())
            scene_counts[scene_id][predicted] += 1

        if not match:
            mismatches.append(row_copy)

    avg_latency = None
    latency_values = [row["latency_s"] for row in rows_by_uid.values() if row.get("latency_s") is not None]
    if latency_values:
        avg_latency = sum(latency_values) / len(latency_values)

    return {
        "total_rows": len(rows_by_uid),
        "stats": stats,
        "predicted_counts": dict(predicted_counts),
        "expected_counts": dict(expected_counts),
        "scene_counts": {scene: dict(counter) for scene, counter in scene_counts.items()},
        "mismatches": mismatches,
        "rows_by_uid": rows_by_uid,
        "avg_latency_s": avg_latency,
    }


def format_counter(counter: Dict[str, int]) -> str:
    ordered_labels = ALLOWED + ["unknown"]
    parts = [f"{label}={counter.get(label, 0)}" for label in ordered_labels if counter.get(label, 0)]
    return ", ".join(parts) if parts else "none"


def answer_query_deterministic(query: str, summary: dict) -> Optional[str]:
    q = query.lower().strip()
    if not q:
        return "Ask about the disaster assessment results, for example: overall accuracy, damage counts, scene-specific counts, or a building UID."

    rows_by_uid = summary["rows_by_uid"]
    stats = summary["stats"] or {}
    predicted_counts = summary["predicted_counts"]
    expected_counts = summary["expected_counts"]
    scene_counts = summary["scene_counts"]
    mismatches = summary["mismatches"]
    total_rows = summary["total_rows"]
    avg_latency_s = summary["avg_latency_s"]

    uid_match = UID_RE.search(query)
    if uid_match:
        uid = uid_match.group(0)
        row = rows_by_uid.get(uid)
        if not row:
            return f"I couldn't find building {uid} in the current assessment results."

        pieces = [
            f"Building {uid}: predicted={row['predicted']}",
            f"expected={row['expected']}",
            f"match={row['match']}",
        ]
        if row.get("scene_id"):
            pieces.append(f"scene={row['scene_id']}")
        if row.get("pre_path"):
            pieces.append(f"pre={row['pre_path']}")
        if row.get("post_path"):
            pieces.append(f"post={row['post_path']}")
        return ", ".join(pieces)

    scene_match = re.search(r"(hurricane-harvey_\d+|000000\d+)", q)
    if scene_match:
        scene_key = scene_match.group(1)
        if scene_key.startswith("000000"):
            scene_key = f"hurricane-harvey_{scene_key}"
        counter = scene_counts.get(scene_key)
        if not counter:
            return f"I couldn't find any rows for {scene_key} in the current assessment results."
        return f"{scene_key}: {format_counter(counter)}."

    if "accuracy" in q or "correct" in q:
        correct = stats.get("correct", 0)
        evaluated = stats.get("evaluated", total_rows)
        accuracy = stats.get("accuracy")
        if accuracy:
            return f"Current accuracy is {accuracy} ({correct}/{evaluated})."
        if evaluated:
            return f"Current accuracy is {correct / evaluated * 100:.2f}% ({correct}/{evaluated})."
        return "I don't have any evaluated rows yet."

    if "expected" in q and ("count" in q or "distribution" in q or "labels" in q):
        return f"Expected label distribution: {format_counter(expected_counts)}."

    if "predicted" in q and ("count" in q or "distribution" in q or "labels" in q):
        return f"Predicted label distribution: {format_counter(predicted_counts)}."

    if "how many" in q or "count" in q or "distribution" in q:
        return (
            f"There are {total_rows} assessed buildings. "
            f"Predicted counts: {format_counter(predicted_counts)}. "
            f"Expected counts: {format_counter(expected_counts)}."
        )

    if "mismatch" in q or "wrong" in q or "incorrect" in q:
        if not mismatches:
            return "There are no mismatches in the current results."
        examples = ", ".join(
            f"{row['uid']} ({row['expected']} -> {row['predicted']})"
            for row in mismatches[:5]
        )
        return f"There are {len(mismatches)} mismatches. Examples: {examples}."

    if "latency" in q or "speed" in q:
        if avg_latency_s is None:
            return "I don't have latency data yet."
        return f"Average model latency is {avg_latency_s:.2f} seconds across {total_rows} rows."

    return None


def build_query_context(summary: dict) -> str:
    lines = [
        "You are answering questions about disaster-assessment results from a local dataset.",
        f"Total assessed buildings: {summary['total_rows']}",
        f"Predicted label counts: {format_counter(summary['predicted_counts'])}",
        f"Expected label counts: {format_counter(summary['expected_counts'])}",
    ]

    stats = summary["stats"] or {}
    if stats:
        lines.append(
            f"Accuracy summary: correct={stats.get('correct', 0)}, evaluated={stats.get('evaluated', 0)}, accuracy={stats.get('accuracy', 'unknown')}"
        )

    if summary["scene_counts"]:
        lines.append("Scene-level predicted counts:")
        for scene, counter in sorted(summary["scene_counts"].items()):
            lines.append(f"- {scene}: {format_counter(counter)}")

    if summary["mismatches"]:
        lines.append("Example mismatches:")
        for row in summary["mismatches"][:10]:
            lines.append(f"- {row['uid']}: expected={row['expected']}, predicted={row['predicted']}, scene={row.get('scene_id')}")

    return "\n".join(lines)


def call_text_model(system_prompt: str, user_prompt: str) -> str:
    headers = {
        "Authorization": f"Bearer {NIM_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 512,
        "temperature": 0.0,
        "top_p": 1,
        "stream": False,
    }

    r = requests.post(
        INVOKE_URL,
        headers=headers,
        json=payload,
        timeout=(CONNECT_TIMEOUT_S, READ_TIMEOUT_S),
    )
    r.raise_for_status()
    j = r.json()
    return str(j["choices"][0]["message"]["content"]).strip()


def answer_query(
    query: str,
    results_csv: Path | None = None,
    stats_json: Path | None = None,
) -> str:
    results_path = results_csv or DEFAULT_RESULTS_CSV
    stats_path = stats_json or DEFAULT_STATS_JSON

    rows = read_results_csv(results_path)
    stats = read_stats_json(stats_path)
    if not rows:
        return f"I couldn't find any assessment rows at {results_path}."

    summary = build_assessment_summary(rows, stats)
    deterministic = answer_query_deterministic(query, summary)
    if deterministic:
        return deterministic

    context = build_query_context(summary)
    if not NIM_API_KEY:
        return (
            "I can answer basic stats from the current assessment results, but the NVIDIA API key is not set for open-ended chat responses. "
            f"Current snapshot: {summary['total_rows']} buildings, predicted counts {format_counter(summary['predicted_counts'])}."
        )

    system_prompt = (
        "Answer questions about disaster assessment results using only the provided dataset context. "
        "Be concise, factual, and do not invent counts or buildings that are not in the context."
    )
    user_prompt = f"Dataset context:\n{context}\n\nQuestion:\n{query}"
    try:
        return call_text_model(system_prompt, user_prompt)
    except requests.exceptions.RequestException as exc:
        return (
            "I couldn't reach the model for an open-ended response. "
            f"Current snapshot: {summary['total_rows']} buildings, predicted counts {format_counter(summary['predicted_counts'])}. "
            f"Model error: {type(exc).__name__}."
        )

# =========================
# Crop pairing
# =========================
UID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
BUILDING_FILE_RE = re.compile(r"^building_(\d+)\.(jpg|jpeg|png|webp)$", re.I)
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


class CropRecord(NamedTuple):
    uid: str
    pre: Path
    post: Path
    expected: Optional[str] = None


class LabelRecord(NamedTuple):
    index: int
    uid: str
    expected: Optional[str]


def infer_kind_from_name(path: Path) -> Optional[str]:
    name = path.stem.lower()
    parts = re.split(r"[^a-z0-9]+", name)
    for part in parts:
        if part in {"pre", "before"}:
            return "pre"
        if part in {"post", "after"}:
            return "post"
    return None


def scene_prefix_from_labels(labels_json: Path) -> str:
    data = read_json(labels_json)
    img_name = ((data.get("metadata") or {}).get("img_name") or labels_json.stem)
    stem = Path(img_name).stem
    for suffix in ["_post_disaster", "_pre_disaster", "_post", "_pre"]:
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def load_label_records(labels_json: Path) -> List[LabelRecord]:
    if not labels_json.exists():
        die(f"Labels JSON not found: {labels_json}")

    data = read_json(labels_json)
    features = (data.get("features") or {}).get("xy") or (data.get("features") or {}).get("lng_lat") or []
    records: List[LabelRecord] = []
    for index, feature in enumerate(features):
        props = feature.get("properties", {})
        uid = str(props.get("uid", "")).strip()
        subtype = props.get("subtype")
        expected = normalize_label(subtype) if subtype else None
        if uid:
            records.append(LabelRecord(index=index, uid=uid, expected=expected))
    return records


def resolve_building_crops_dirs(folder: Path, labels_json: Path) -> Optional[Tuple[Path, Path]]:
    scene_prefix = scene_prefix_from_labels(labels_json)

    if folder.name.endswith("_pre_disaster"):
        pre_dir = folder
        post_dir = folder.with_name(folder.name.replace("_pre_disaster", "_post_disaster"))
        return (pre_dir, post_dir) if post_dir.exists() else None

    if folder.name.endswith("_post_disaster"):
        post_dir = folder
        pre_dir = folder.with_name(folder.name.replace("_post_disaster", "_pre_disaster"))
        return (pre_dir, post_dir) if pre_dir.exists() else None

    pre_dir = folder / f"{scene_prefix}_pre_disaster"
    post_dir = folder / f"{scene_prefix}_post_disaster"
    if pre_dir.exists() and post_dir.exists():
        return pre_dir, post_dir

    return None


def scan_uid_named_crops(folder: Path) -> Dict[str, CropRecord]:
    """
    Support legacy crop outputs where filenames contain UID + pre/post.
    """
    pairs: Dict[str, Dict[str, Path]] = {}
    images = [p for p in folder.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE_EXTS]

    for p in images:
        m = UID_RE.search(p.name)
        if not m:
            continue
        uid = m.group(0)
        name = p.name.lower()
        kind = None
        if "pre" in name:
            kind = "pre"
        elif "post" in name:
            kind = "post"
        elif "before" in name:
            kind = "pre"
        elif "after" in name:
            kind = "post"

        if kind is None:
            
            continue

        pairs.setdefault(uid, {})
        
        pairs[uid][kind] = p

    
    ready = {
        uid: CropRecord(uid=uid, pre=data["pre"], post=data["post"])
        for uid, data in pairs.items()
        if "pre" in data and "post" in data
    }
    return ready


def scan_building_crops(folder: Path, labels_json: Path) -> Dict[str, CropRecord]:
    pair_dirs = resolve_building_crops_dirs(folder, labels_json)
    if not pair_dirs:
        return {}

    pre_dir, post_dir = pair_dirs
    if not pre_dir.exists() or not post_dir.exists():
        return {}

    label_records = load_label_records(labels_json)
    by_index = {record.index: record for record in label_records}

    pre_files: Dict[int, Path] = {}
    post_files: Dict[int, Path] = {}

    for path in pre_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
            continue
        m = BUILDING_FILE_RE.match(path.name)
        if m:
            pre_files[int(m.group(1))] = path

    for path in post_dir.iterdir():
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTS:
            continue
        m = BUILDING_FILE_RE.match(path.name)
        if m:
            post_files[int(m.group(1))] = path

    ready: Dict[str, CropRecord] = {}
    for index in sorted(set(pre_files) & set(post_files)):
        record = by_index.get(index)
        if not record:
            continue
        ready[record.uid] = CropRecord(
            uid=record.uid,
            pre=pre_files[index],
            post=post_files[index],
            expected=record.expected,
        )
    return ready


def scan_crops_folder(folder: Path, labels_json: Path) -> Dict[str, CropRecord]:
    """
    Supports:
      - building_crops/<scene>_pre_disaster + <scene>_post_disaster with building_<index>.png
      - legacy UID-based crop folders/files
    """
    if not folder.exists():
        die(f"Crops folder not found: {folder}")

    building_ready = scan_building_crops(folder, labels_json)
    if building_ready:
        return building_ready

    return scan_uid_named_crops(folder)

# =========================
# Ground-truth mapping
# =========================
def load_ground_truth(labels_json: Path) -> Dict[str, str]:
    """
    Expects your FEMA labels JSON where:
      features.lng_lat[i].properties.uid
      features.lng_lat[i].properties.subtype   (damage label)
    """
    if not labels_json.exists():
        die(f"Labels JSON not found: {labels_json}")

    data = read_json(labels_json)
    feats = data.get("features", {}).get("lng_lat", [])
    gt = {}
    for f in feats:
        props = f.get("properties", {})
        uid = props.get("uid")
        subtype = props.get("subtype")
        if uid and subtype:
            norm = normalize_label(subtype)
            gt[str(uid)] = norm if norm else str(subtype).strip().lower()
    return gt

# =========================
# Model call
# =========================
def build_damage_presence_prompt(uid: str) -> str:
    return (
        "You are analyzing hurricane damage using satellite imagery.\n\n"

        "You will receive TWO images of the SAME building:\n"
        "1) PRE-DISASTER image (before hurricane)\n"
        "2) POST-DISASTER image (after hurricane)\n\n"

        "Your task is to decide how much visible NEW disaster impact appears in POST compared with PRE.\n\n"

        "Choose EXACTLY ONE answer for impact_level:\n"
        "none\n"
        "limited\n"
        "serious\n\n"

        "Important decision rules:\n"
        "- Judge damage ONLY by visible change from PRE to POST.\n"
        "- Do NOT call damage based on shadows, blur, crop edges, different lighting, vegetation, or low resolution.\n"
        "- Visible floodwater around, surrounding, or encroaching on the building footprint counts as relevant disaster-impact evidence.\n"
        "- An intact-looking roof does NOT automatically mean no-damage if the building or surrounding lot is clearly flooded in POST.\n"
        "- You do NOT need to see roof failure for impact_level=serious.\n"
        "- Use none when PRE and POST look materially the same.\n"
        "- Use none when evidence is weak or ambiguous.\n"
        "- Use limited for subtle or localized change that may indicate only minor damage.\n"
        "- Use serious only for clear, substantial disaster impact such as obvious flooding around the building area, major debris, missing roof sections, or structural failure.\n\n"

        "Return ONLY a JSON object in this format:\n"
        '{"uid":"' + uid + '","impact_level":"none_or_limited_or_serious","evidence":"short phrase"}\n\n'

        "Do not include explanations or additional text."
    )


def build_full_classification_prompt(uid: str) -> str:
    return (
        "You are analyzing hurricane damage using satellite imagery.\n\n"

        "You will receive TWO images of the SAME building:\n"
        "1) PRE-DISASTER image (before hurricane)\n"
        "2) POST-DISASTER image (after hurricane)\n\n"

        "Classify the final damage label conservatively.\n\n"

        "Choose EXACTLY ONE damage label:\n"
        "no-damage\n"
        "minor-damage\n"
        "major-damage\n"
        "destroyed\n\n"

        "Important decision rules:\n"
        "- Judge damage ONLY by visible change from PRE to POST.\n"
        "- Do NOT call damage based on shadows, blur, crop edges, different lighting, vegetation, or low resolution.\n"
        "- Use no-damage when PRE and POST look materially the same or the evidence is weak.\n"
        "- Flood context matters: visible inundation around the building can support major-damage even when the roof remains mostly intact.\n"
        "- If POST shows widespread flooding around the building footprint, lot, or immediate access area and PRE does not, major-damage is allowed.\n"
        "- Use minor-damage for limited, localized visible change.\n"
        "- Use destroyed only for collapse or near-total destruction.\n\n"

        "Return ONLY a JSON object in this format:\n"
        '{"uid":"' + uid + '","subtype":"LABEL","evidence":"short phrase"}\n\n'

        "Do not include explanations or additional text."
    )


def build_severity_prompt(uid: str) -> str:
    return (
        "You are analyzing hurricane damage using satellite imagery.\n\n"

        "You will receive TWO images of the SAME building:\n"
        "1) PRE-DISASTER image (before hurricane)\n"
        "2) POST-DISASTER image (after hurricane)\n\n"

        "Assume there IS visible new damage in POST compared with PRE.\n"
        "Your task is to classify the damage severity conservatively.\n\n"

        "Choose EXACTLY ONE damage label:\n"
        "minor-damage\n"
        "major-damage\n"
        "destroyed\n\n"

        "Damage definitions:\n"
        "minor-damage: limited new damage such as a small roof patch change, light debris, localized impact, or shallow flooding with limited visible impact\n"
        "major-damage: clear substantial damage such as large roof sections missing, major structural breakage, extensive debris directly affecting the building, or obvious significant flooding surrounding, isolating, or entering the structure area\n"
        "destroyed: collapse, near-total destruction, or most of the structure missing\n\n"

        "Important decision rules:\n"
        "- Judge damage ONLY by visible change from PRE to POST.\n"
        "- Do NOT call damage based on shadows, blur, crop edges, different lighting, or low resolution.\n"
        "- Do NOT assume roof loss unless the POST image clearly shows new missing structure compared with PRE.\n"
        "- Flood context matters: visible inundation around the building can support major-damage even when the roof remains mostly intact.\n"
        "- If POST shows widespread flooding around the building footprint, lot, or immediate access area and PRE does not, prefer major-damage over no-damage.\n"
        "- If there is clear change but it is limited, prefer minor-damage over major-damage.\n"
        "- Use major-damage when there is either substantial structural failure OR clearly serious flooding affecting the structure area.\n"
        "- Use destroyed only for collapse or near-total destruction.\n"
        "- If the damage is visible but limited, choose minor-damage.\n\n"

        "Focus on visual evidence such as:\n"
        "- roof condition changes\n"
        "- debris around the structure\n"
        "- missing building sections\n"
        "- collapse or footprint deformation\n"
        "- floodwater surrounding the building or covering the lot\n"
        "- inundation that clearly appears new in POST compared with PRE\n\n"

        "If the crop is unclear or partially off-center, rely only on clear visible evidence.\n\n"

        "Return ONLY a JSON object in this format:\n"
        '{"uid":"' + uid + '","subtype":"LABEL","evidence":"short phrase"}\n\n'

        "Do not include explanations or additional text."
    )


def build_multimodal_content(prompt: str, pre_img: Path, post_img: Path) -> List[dict]:
    return [
        {"type": "text", "text": prompt},
        {"type": "text", "text": "PRE-DISASTER IMAGE"},
        {"type": "image_url", "image_url": {"url": base64_data_url(pre_img)}},
        {"type": "text", "text": "POST-DISASTER IMAGE"},
        {"type": "image_url", "image_url": {"url": base64_data_url(post_img)}},
    ]


def call_structured_model(pre_img: Path, post_img: Path, prompt: str) -> Tuple[Optional[dict], int, str, float]:
    """
    Returns: (parsed_json, http_status_or_-1, raw_text, latency_s)
    """
    headers = {
        "Authorization": f"Bearer {NIM_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_multimodal_content(prompt, pre_img, post_img)},
        ],
        "max_tokens": 256,
        "temperature": 0.0,
        "top_p": 1,
        "stream": False,
    }

    last_exc = None
    start = time.time()
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            r = requests.post(
                INVOKE_URL,
                headers=headers,
                json=payload,
                timeout=(CONNECT_TIMEOUT_S, READ_TIMEOUT_S),
            )
            latency = time.time() - start
            status = r.status_code

            if status != 200:
                return (None, status, r.text[:2000], latency)

            j = r.json()
            raw = j["choices"][0]["message"]["content"]
            parsed = extract_json_from_text(raw)
            if parsed and isinstance(parsed, dict):
                return (parsed, 200, raw, latency)

            return (None, 200, raw, latency)

        except requests.exceptions.RequestException as e:
            last_exc = e
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_BACKOFF_S * attempt)
                continue
            latency = time.time() - start
            return (None, -1, f"{type(e).__name__}:{e}", latency)

    latency = time.time() - start
    return (None, -1, f"{type(last_exc).__name__}:{last_exc}", latency)


def call_model(pre_img: Path, post_img: Path, uid: str) -> Tuple[str, int, str, float]:
    presence_prompt = build_damage_presence_prompt(uid)
    parsed_presence, status, raw_presence, latency_presence = call_structured_model(pre_img, post_img, presence_prompt)
    if status != 200 or not parsed_presence:
        return ("ERROR", status, raw_presence, latency_presence)

    impact_level = normalize_impact_level(parsed_presence.get("impact_level"))
    if impact_level == "none":
        return ("no-damage", 200, raw_presence, latency_presence)

    if impact_level is None or evidence_is_weak(parsed_presence.get("evidence")):
        return ("no-damage", 200, raw_presence, latency_presence)

    if impact_level == "limited":
        classify_prompt = build_full_classification_prompt(uid)
        parsed_classify, cls_status, raw_classify, latency_classify = call_structured_model(pre_img, post_img, classify_prompt)
        combined_latency = latency_presence + latency_classify
        combined_raw = f"{raw_presence} || {raw_classify}"

        if cls_status != 200 or not parsed_classify:
            return ("ERROR", cls_status, combined_raw, combined_latency)

        pred = normalize_label(str(parsed_classify.get("subtype", "")))
        if not pred:
            return ("no-damage", 200, combined_raw, combined_latency)
        if pred == "minor-damage" and evidence_is_weak(parsed_classify.get("evidence")):
            return ("no-damage", 200, combined_raw, combined_latency)
        return (pred, 200, combined_raw, combined_latency)

    severity_prompt = build_severity_prompt(uid)
    parsed_severity, sev_status, raw_severity, latency_severity = call_structured_model(pre_img, post_img, severity_prompt)
    combined_latency = latency_presence + latency_severity
    combined_raw = f"{raw_presence} || {raw_severity}"

    if sev_status != 200 or not parsed_severity:
        return ("ERROR", sev_status, combined_raw, combined_latency)

    pred = normalize_label(str(parsed_severity.get("subtype", "")))
    if not pred or pred == "no-damage":
        return ("major-damage", 200, combined_raw, combined_latency)

    if pred == "minor-damage" and evidence_is_weak(parsed_severity.get("evidence")):
        return ("no-damage", 200, combined_raw, combined_latency)

    return (pred, 200, combined_raw, combined_latency)

# =========================
# Output writers
# =========================
def append_csv_row(csv_path: Path, row: List[str], header: Optional[List[str]] = None):
    """
    Simple CSV writer without extra deps. Escapes quotes.
    """
    def esc(x: str) -> str:
        x = "" if x is None else str(x)
        if any(c in x for c in [",", '"', "\n", "\r"]):
            x = '"' + x.replace('"', '""') + '"'
        return x

    csv_path.parent.mkdir(parents=True, exist_ok=True)
    exists = csv_path.exists()
    with csv_path.open("a", encoding="utf-8", newline="") as f:
        if header and not exists:
            f.write(",".join(esc(h) for h in header) + "\n")
        f.write(",".join(esc(v) for v in row) + "\n")

def build_fema_output_template(labels_json: dict) -> dict:
    """
    Start from the provided labels json structure but remove subtype values (we'll fill predicted).
    We'll keep geometry as-is and set subtype=predicted for each uid.
    """
    out = json.loads(json.dumps(labels_json))  # deep copy
    feats = out.get("features", {}).get("lng_lat", [])
    for f in feats:
        props = f.get("properties", {})
        # ensure subtype exists but empty for now
        props["subtype"] = props.get("subtype", None)
        f["properties"] = props
    return out

def write_predicted_fema_json(
    out_path: Path,
    base_labels_json: dict,
    uid_to_pred: Dict[str, str]
):
    """
    Writes a FEMA-style JSON where each building feature has properties.subtype set to predicted label.
    """
    out = build_fema_output_template(base_labels_json)
    feats = out.get("features", {}).get("lng_lat", [])
    for f in feats:
        props = f.get("properties", {})
        uid = str(props.get("uid", "")).strip()
        if uid in uid_to_pred:
            props["subtype"] = uid_to_pred[uid]
        f["properties"] = props
    write_json(out_path, out)

# =========================
# Main
# =========================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--crops-dir",
        required=True,
        help=r'Path to crops folder, e.g. "C:\Users\ryan\AutomatedDisasterDamageAssessment\outputs\crops\hurricane-harvey_00000011"'
    )
    ap.add_argument(
        "--labels-json",
        required=True,
        help=r'Path to FEMA labels JSON for this image (post json that contains subtype ground truth).'
    )
    ap.add_argument(
        "--out-dir",
        default=None,
        help=r'Output dir (default: <crops-dir>\_predictions)'
    )
    ap.add_argument(
        "--resume",
        action="store_true",
        help="If set, skip UIDs already present in results.csv"
    )
    ap.add_argument(
        "--output-suffix",
        default="",
        help="Optional suffix appended to results/stats/predictions filenames, e.g. '_secondary'"
    )
    args = ap.parse_args()

    if not NIM_API_KEY:
        die("NIM_API_KEY is empty. Hardcode your key at the top of this script.")

    crops_dir = Path(args.crops_dir)
    labels_path = Path(args.labels_json)

    if args.out_dir:
        out_dir = Path(args.out_dir)
    else:
        out_dir = crops_dir / "_predictions"

    ensure_dir(out_dir)
    output_suffix = args.output_suffix.strip()
    stats_file = out_dir / f"stats{output_suffix}.json"

    # Load ground truth
    gt = load_ground_truth(labels_path)
    labels_json_obj = read_json(labels_path)
    scene_id = scene_prefix_from_labels(labels_path)

    # Discover crop pairs
    ready = scan_crops_folder(crops_dir, labels_path)
    if not ready:
        die(
            f"No complete (pre+post) crop pairs found in {crops_dir}. "
            "Expected either building_crops scene folders or filenames containing UID and 'pre'/'post'."
        )

    uids = sorted(ready.keys())
    total = len(uids)

    # Resume support
    csv_path = out_dir / f"results{output_suffix}.csv"
    predictions_json_path = out_dir / f"predictions{output_suffix}.json"
    done_uids: set[str] = set()
    uid_to_pred: Dict[str, str] = {}
    correct = 0
    evaluated = 0
    if csv_path.exists():
        done_uids, uid_to_pred, correct, evaluated = load_existing_run_state(csv_path)

    print(
        f"Existing cached results for {scene_id}: "
        f"{len(done_uids)} building(s), correct={correct}, evaluated={evaluated}"
    )

    # Initialize RPM limiter
    last_call_ts = 0.0

    # CSV header
    header = [
        "uid", "expected", "predicted", "match",
        "status", "latency_s", "pre_path", "post_path", "raw_excerpt"
    ]

    # Print run info
    print(f"Scene: {scene_id}")
    print(f"Found {total} crop pairs in: {crops_dir}")
    print(f"Writing outputs to: {out_dir}")
    if output_suffix:
        print(f"Using output suffix: {output_suffix}")
    print(f"RPM_LIMIT={RPM_LIMIT} => MIN_INTERVAL_S={MIN_INTERVAL_S:.3f}s")
    if args.resume:
        print(f"Resume enabled: {len(done_uids)} uid(s) already in results.csv will be skipped.")

    for i, uid in enumerate(uids, 1):
        uid = coerce_uid(uid)

        if args.resume and uid in done_uids:
            # still keep pred if you want; but we don't have it easily without parsing csv
            print(f"[{i}/{total}] UID={uid} ... SKIP (resume)")
            continue

        pre_path = ready[uid].pre
        post_path = ready[uid].post

        expected = ready[uid].expected or gt.get(uid, "UNKNOWN")

      
        now = time.time()
        wait = (last_call_ts + MIN_INTERVAL_S) - now
        if wait > 0:
            time.sleep(wait)

        pred, status, raw, latency = call_model(pre_path, post_path, uid)

        last_call_ts = time.time()
        # -----------------------------------------------------------

        # Decide match
        match = (pred == expected) if (expected != "UNKNOWN" and pred != "ERROR") else False
        if expected != "UNKNOWN" and pred != "ERROR":
            evaluated += 1
            if match:
                correct += 1

        # write updated stats to file
        scene_accuracy = f"{correct / evaluated * 100:.2f}%" if evaluated > 0 else "N/A"
        with stats_file.open("w", encoding="utf-8") as f:
            json.dump({
                "scene_id": scene_id,
                "correct": correct,
                "evaluated": evaluated,
                "accuracy": scene_accuracy,
                "total_crop_pairs": total,
                "completed_predictions": len(uid_to_pred) + 1,
                "output_suffix": output_suffix,
            }, f)

        uid_to_pred[uid] = pred

        raw_excerpt = raw.strip().replace("\n", " ")[:300]
        append_csv_row(
            csv_path,
            [
                uid, expected, pred, str(match),
                str(status), f"{latency:.3f}",
                str(pre_path), str(post_path),
                raw_excerpt
            ],
            header=header
        )

        # Live progress
        acc = (correct / evaluated * 100.0) if evaluated > 0 else 0.0
        tag = "OK" if status == 200 and pred != "ERROR" else "ERR"
        msg = f"[{i}/{total}] UID={uid} ... {tag} status={status} pred={pred} exp={expected} match={match}"
        if evaluated > 0:
            msg += f" | scene_acc={acc:.1f}% ({correct}/{evaluated})"
        if status == -1 and "RequestException" in raw:
            msg += f" req_exc={raw_excerpt}"
        print(msg)

        # Save incremental JSON every 5 buildings (record keeping)
        if i % 5 == 0 or i == total:
            write_predicted_fema_json(predictions_json_path, labels_json_obj, uid_to_pred)

    # Final write
    write_predicted_fema_json(predictions_json_path, labels_json_obj, uid_to_pred)

    # Summary
    print("\nDone.")
    if evaluated > 0:
        print(f"Scene accuracy for {scene_id}: {correct}/{evaluated} = {correct/evaluated*100:.2f}%")
    else:
        print(f"No evaluated rows for {scene_id} (expected labels missing or all predictions errored).")
    print(f"CSV: {csv_path}")
    print(f"Pred JSON: {predictions_json_path}")

if __name__ == "__main__":
    main()
