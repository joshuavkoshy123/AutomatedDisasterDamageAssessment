# crop_from_xy.py
# Crops PRE and POST disaster images using *pixel-space* polygons from the JSON "features.xy[*].wkt".
#
# Updates:
# 1) Dynamic padding: base pad + optional extra pad computed from estimated post-vs-pre shift.
# 2) Organized outputs per scene/image id (e.g., hurricane-harvey_00000003/) so multi-runs aren't jumbled.
# 3) Overwrites existing JPEGs by default (same filenames).
#
# Usage:
#   python backend/crop_from_xy.py
#
# Optional:
#   python backend/crop_from_xy.py --pad 12 --max-extra-pad 48 --shift-scale 1.25
#
# Notes:
# - We do NOT use any AI/API. We only use pixel coords in JSON (features.xy[].wkt).
# - We compute bboxes separately for pre and post (don’t assume identical polygons).
# - Dynamic padding helps when post imagery is slightly shifted.

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import numpy as np

# -----------------------------
# Root detection (Option B)
# -----------------------------
ROOT = Path(__file__).resolve().parents[1]  # .../AutomatedDisasterDamageAssessment

WKT_POLY_RE = re.compile(
    r"POLYGON\s*\(\(\s*(?P<body>.+?)\s*\)\)\s*$",
    flags=re.IGNORECASE | re.DOTALL,
)


@dataclass
class Feature:
    uid: str
    subtype: Optional[str]
    pts: np.ndarray  # (N,2) float32


def parse_polygon_wkt_xy(wkt: str) -> np.ndarray:
    m = WKT_POLY_RE.match(wkt.strip())
    if not m:
        raise ValueError(f"Unsupported/invalid WKT polygon: {wkt[:80]}...")
    body = m.group("body")
    pts: List[Tuple[float, float]] = []
    for chunk in body.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = chunk.split()
        if len(parts) < 2:
            continue
        x = float(parts[0])
        y = float(parts[1])
        pts.append((x, y))
    if len(pts) < 3:
        raise ValueError(f"Polygon has too few points: {wkt}")
    return np.array(pts, dtype=np.float32)


def load_features_by_uid(json_path: Path) -> Tuple[Dict[str, Feature], dict]:
    data = json.loads(json_path.read_text(encoding="utf-8"))
    feats = data.get("features", {})
    xy_list = feats.get("xy", [])
    if not isinstance(xy_list, list):
        raise ValueError(f"JSON format unexpected at {json_path}: features.xy is not a list")

    out: Dict[str, Feature] = {}
    for item in xy_list:
        props = item.get("properties", {}) or {}
        uid = props.get("uid")
        if not uid:
            continue
        subtype = props.get("subtype")
        wkt = item.get("wkt")
        if not wkt:
            continue
        try:
            pts = parse_polygon_wkt_xy(wkt)
        except Exception:
            continue
        out[uid] = Feature(uid=uid, subtype=subtype, pts=pts)

    return out, data.get("metadata", {}) or {}


def clamp_bbox(x0: int, y0: int, x1: int, y1: int, w: int, h: int) -> Tuple[int, int, int, int]:
    x0 = max(0, min(x0, w - 1))
    y0 = max(0, min(y0, h - 1))
    x1 = max(0, min(x1, w))
    y1 = max(0, min(y1, h))
    if x1 <= x0:
        x1 = min(w, x0 + 1)
    if y1 <= y0:
        y1 = min(h, y0 + 1)
    return x0, y0, x1, y1


def bbox_from_pts(pts: np.ndarray, pad: int) -> Tuple[int, int, int, int]:
    xs = pts[:, 0]
    ys = pts[:, 1]
    x0 = int(np.floor(xs.min())) - pad
    y0 = int(np.floor(ys.min())) - pad
    x1 = int(np.ceil(xs.max())) + pad
    y1 = int(np.ceil(ys.max())) + pad
    return x0, y0, x1, y1


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def scene_id_from_metadata(meta_pre: dict, meta_post: dict, pre_img_path: Path, post_img_path: Path) -> str:
    """
    Prefer to derive a stable folder name like 'hurricane-harvey_00000003'
    from metadata.img_name, else from image filenames.
    """
    def base_from_img_name(img_name: Optional[str]) -> Optional[str]:
        if not img_name:
            return None
        # e.g. hurricane-harvey_00000003_pre_disaster.png -> hurricane-harvey_00000003
        name = Path(img_name).stem
        for suffix in ["_pre_disaster", "_post_disaster", "_pre", "_post"]:
            if name.endswith(suffix):
                return name[: -len(suffix)]
        return name

    cand = base_from_img_name(meta_pre.get("img_name")) or base_from_img_name(meta_post.get("img_name"))
    if cand:
        return cand

    # fallback: try actual file names
    for p in [pre_img_path, post_img_path]:
        name = p.stem
        for suffix in ["_pre_disaster", "_post_disaster", "_pre", "_post"]:
            if name.endswith(suffix):
                return name[: -len(suffix)]
    return pre_img_path.stem


def centroid(pts: np.ndarray) -> np.ndarray:
    return np.mean(pts, axis=0)


def estimate_global_shift(pre_feats: Dict[str, Feature], post_feats: Dict[str, Feature], uids: List[str]) -> Tuple[float, float]:
    """
    Estimate typical pixel shift (dx, dy) from pre->post using matched polygon centroids.
    Uses median for robustness.
    """
    if not uids:
        return 0.0, 0.0
    deltas = []
    for uid in uids:
        c_pre = centroid(pre_feats[uid].pts)
        c_post = centroid(post_feats[uid].pts)
        d = c_post - c_pre  # dx, dy
        deltas.append(d)
    deltas = np.stack(deltas, axis=0)  # (M,2)
    dx = float(np.median(deltas[:, 0]))
    dy = float(np.median(deltas[:, 1]))
    return dx, dy


def extra_pad_for_uid(
    uid: str,
    pre_f: Feature,
    post_f: Feature,
    global_dx: float,
    global_dy: float,
    shift_scale: float,
    max_extra_pad: int,
) -> int:
    """
    Convert shift magnitude into a per-uid extra padding.
    We combine:
      - global shift magnitude (robust median)
      - per-uid shift residual (how "off" this building is vs global)
    """
    c_pre = centroid(pre_f.pts)
    c_post = centroid(post_f.pts)
    dx = float(c_post[0] - c_pre[0])
    dy = float(c_post[1] - c_pre[1])

    # residual relative to typical shift
    rdx = dx - global_dx
    rdy = dy - global_dy

    mag = (dx * dx + dy * dy) ** 0.5
    rmag = (rdx * rdx + rdy * rdy) ** 0.5

    extra = int(np.ceil(shift_scale * (mag + rmag)))
    extra = max(0, min(extra, int(max_extra_pad)))
    return extra


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop pre/post images using pixel-space WKT polygons from JSON.")
    parser.add_argument("--pre-img", type=str, default=str(ROOT / "images" / "hurricane-harvey_00000003_pre_disaster.png"))
    parser.add_argument("--post-img", type=str, default=str(ROOT / "images" / "hurricane-harvey_00000003_post_disaster.png"))
    parser.add_argument("--pre-json", type=str, default=str(ROOT / "labels" / "hurricane-harvey_00000003_pre_disaster.json"))
    parser.add_argument("--post-json", type=str, default=str(ROOT / "labels" / "hurricane-harvey_00000003_post_disaster.json"))

    parser.add_argument("--out-root", type=str, default=str(ROOT / "outputs" / "crops"),
                        help="Root folder; script will create a subfolder per scene (e.g., .../crops/hurricane-harvey_00000003/)")
    parser.add_argument("--pad", type=int, default=12, help="base padding in pixels around polygon bbox")
    parser.add_argument("--max-extra-pad", type=int, default=48, help="cap for dynamic extra padding")
    parser.add_argument("--shift-scale", type=float, default=1.25, help="multiplier for shift-based extra padding")

    parser.add_argument("--min-size", type=int, default=8, help="skip crops smaller than this (either dimension)")
    parser.add_argument("--write-masks", action="store_true", help="also write polygon masks (debug)")
    args = parser.parse_args()

    pre_img_path = Path(args.pre_img)
    post_img_path = Path(args.post_img)
    pre_json_path = Path(args.pre_json)
    post_json_path = Path(args.post_json)

    out_root = Path(args.out_root)
    base_pad = int(args.pad)

    # Load images
    pre_img = cv2.imread(str(pre_img_path), cv2.IMREAD_COLOR)
    post_img = cv2.imread(str(post_img_path), cv2.IMREAD_COLOR)
    if pre_img is None:
        raise RuntimeError(f"Could not read PRE image: {pre_img_path}")
    if post_img is None:
        raise RuntimeError(f"Could not read POST image: {post_img_path}")

    pre_h, pre_w = pre_img.shape[:2]
    post_h, post_w = post_img.shape[:2]

    # Load features + metadata
    if not pre_json_path.exists():
        raise RuntimeError(f"Missing PRE json: {pre_json_path} (override with --pre-json)")
    if not post_json_path.exists():
        raise RuntimeError(f"Missing POST json: {post_json_path} (override with --post-json)")

    pre_feats, pre_meta = load_features_by_uid(pre_json_path)
    post_feats, post_meta = load_features_by_uid(post_json_path)

    # Match by uid
    uids = sorted(set(pre_feats.keys()) & set(post_feats.keys()))
    if not uids:
        raise RuntimeError(
            "No overlapping uids between pre and post JSON.\n"
            f"PRE uids={len(pre_feats)} POST uids={len(post_feats)}"
        )

    # Organized output folder per scene
    scene_id = scene_id_from_metadata(pre_meta, post_meta, pre_img_path, post_img_path)
    out_dir = out_root / scene_id
    ensure_dir(out_dir)

    # Estimate typical shift (helpful when post is up/left of pre, etc.)
    global_dx, global_dy = estimate_global_shift(pre_feats, post_feats, uids)
    print(f"[INFO] estimated_global_shift dx={global_dx:.2f}px dy={global_dy:.2f}px")
    print(f"[INFO] base_pad={base_pad}px max_extra_pad={args.max_extra_pad}px shift_scale={args.shift_scale}")

    index_path = out_dir / "crops_index.csv"
    rows: List[List[str]] = []

    processed = 0
    saved = 0
    skipped = 0

    for uid in uids:
        processed += 1
        pre_f = pre_feats[uid]
        post_f = post_feats[uid]

        extra = extra_pad_for_uid(
            uid=uid,
            pre_f=pre_f,
            post_f=post_f,
            global_dx=global_dx,
            global_dy=global_dy,
            shift_scale=float(args.shift_scale),
            max_extra_pad=int(args.max_extra_pad),
        )
        pad = base_pad + extra

        # Compute bbox per image with dynamic pad
        pre_x0, pre_y0, pre_x1, pre_y1 = bbox_from_pts(pre_f.pts, pad)
        post_x0, post_y0, post_x1, post_y1 = bbox_from_pts(post_f.pts, pad)

        pre_x0, pre_y0, pre_x1, pre_y1 = clamp_bbox(pre_x0, pre_y0, pre_x1, pre_y1, pre_w, pre_h)
        post_x0, post_y0, post_x1, post_y1 = clamp_bbox(post_x0, post_y0, post_x1, post_y1, post_w, post_h)

        pre_crop = pre_img[pre_y0:pre_y1, pre_x0:pre_x1]
        post_crop = post_img[post_y0:post_y1, post_x0:post_x1]

        if pre_crop.shape[0] < args.min_size or pre_crop.shape[1] < args.min_size:
            skipped += 1
            continue
        if post_crop.shape[0] < args.min_size or post_crop.shape[1] < args.min_size:
            skipped += 1
            continue

        # Overwrite outputs by design
        pre_out = out_dir / f"{uid}_pre.jpg"
        post_out = out_dir / f"{uid}_post.jpg"
        cv2.imwrite(str(pre_out), pre_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        cv2.imwrite(str(post_out), post_crop, [int(cv2.IMWRITE_JPEG_QUALITY), 95])

        # Optional debug masks
        mask_pre_out = ""
        mask_post_out = ""
        if args.write_masks:
            # Create mask for the crop region
            pre_mask = np.zeros((pre_crop.shape[0], pre_crop.shape[1]), dtype=np.uint8)
            post_mask = np.zeros((post_crop.shape[0], post_crop.shape[1]), dtype=np.uint8)

            # Shift polygon points into crop-local coordinates
            pre_local = (pre_f.pts - np.array([pre_x0, pre_y0], dtype=np.float32)).astype(np.int32)
            post_local = (post_f.pts - np.array([post_x0, post_y0], dtype=np.float32)).astype(np.int32)

            cv2.fillPoly(pre_mask, [pre_local], 255)
            cv2.fillPoly(post_mask, [post_local], 255)

            mask_pre_path = out_dir / f"{uid}_pre_mask.png"
            mask_post_path = out_dir / f"{uid}_post_mask.png"
            cv2.imwrite(str(mask_pre_path), pre_mask)
            cv2.imwrite(str(mask_post_path), post_mask)
            mask_pre_out = str(mask_pre_path)
            mask_post_out = str(mask_post_path)

        subtype = post_f.subtype or ""
        rows.append([
            uid,
            subtype,
            str(pre_out),
            str(post_out),
            mask_pre_out,
            mask_post_out,
            str(pad),
            f"{pre_x0},{pre_y0},{pre_x1},{pre_y1}",
            f"{post_x0},{post_y0},{post_x1},{post_y1}",
            f"{pre_crop.shape[1]}x{pre_crop.shape[0]}",
            f"{post_crop.shape[1]}x{post_crop.shape[0]}",
        ])
        saved += 1

        if processed % 10 == 0 or processed == len(uids):
            print(f"[PROGRESS] processed={processed}/{len(uids)} saved={saved} skipped={skipped}")

    # Write index CSV (overwrite)
    with index_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "uid",
            "post_subtype",
            "pre_crop_path",
            "post_crop_path",
            "pre_mask_path",
            "post_mask_path",
            "pad_used_px",
            "pre_bbox_xyxy",
            "post_bbox_xyxy",
            "pre_size",
            "post_size",
        ])
        w.writerows(rows)

    print(f"\n[DONE] scene={scene_id} matched_uids={len(uids)} saved={saved} skipped={skipped}")
    print(f"[OUT] {out_dir}")
    print(f"[INDEX] {index_path}")


if __name__ == "__main__":
    main()