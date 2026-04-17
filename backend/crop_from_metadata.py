from __future__ import annotations

import argparse
import json
import re
from io import BytesIO
from pathlib import Path
from typing import Dict, Iterable, List, NamedTuple, Optional, Tuple

import requests
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
GEOJSON_DIR = BACKEND_DIR / "GeoJSON"
METADATA_FILE = BACKEND_DIR / "metadata.json"
DEFAULT_URLS_FILE = ROOT / "image_urls.txt"
DEFAULT_OUTPUT_DIR = ROOT / "building_crops"

PADDING = 30
CONTEXT_SCALE = 0.75
MIN_CROP_SIZE = 192
REQUEST_TIMEOUT_S = 60
SCENE_RE = re.compile(r"(hurricane-harvey_\d+)_(pre|post)_disaster", re.IGNORECASE)


class SceneImages(NamedTuple):
    pre_url: str
    post_url: str


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def geo_to_pixel(
    lon: float,
    lat: float,
    start_x: float,
    pixel_width: float,
    start_y: float,
    pixel_height: float,
) -> Tuple[float, float]:
    x = (lon - start_x) / pixel_width
    y = (lat - start_y) / pixel_height
    return x, y


def extract_urls(lines: Iterable[str]) -> List[str]:
    urls: List[str] = []
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        if not line.startswith("http://") and not line.startswith("https://"):
            continue
        urls.append(line)
    return urls


def scene_and_kind_from_url(url: str) -> Optional[Tuple[str, str]]:
    match = SCENE_RE.search(url)
    if not match:
        return None
    return match.group(1), match.group(2).lower()


def load_scene_urls(urls_file: Path) -> Dict[str, SceneImages]:
    if not urls_file.exists():
        raise FileNotFoundError(f"URLs file not found: {urls_file}")

    urls = extract_urls(urls_file.read_text(encoding="utf-8").splitlines())
    per_scene: Dict[str, Dict[str, str]] = {}

    for url in urls:
        scene_info = scene_and_kind_from_url(url)
        if not scene_info:
            continue
        scene_id, kind = scene_info
        per_scene.setdefault(scene_id, {})
        per_scene[scene_id][kind] = url

    complete: Dict[str, SceneImages] = {}
    for scene_id, data in per_scene.items():
        if "pre" in data and "post" in data:
            complete[scene_id] = SceneImages(pre_url=data["pre"], post_url=data["post"])

    return dict(sorted(complete.items()))


def download_image(url: str) -> Image.Image:
    response = requests.get(url, timeout=REQUEST_TIMEOUT_S)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGB")


def clip_box(
    min_x: int,
    min_y: int,
    max_x: int,
    max_y: int,
    width: int,
    height: int,
) -> Tuple[int, int, int, int]:
    min_x = max(0, min_x)
    min_y = max(0, min_y)
    max_x = min(width, max_x)
    max_y = min(height, max_y)
    return min_x, min_y, max_x, max_y


def build_context_box(
    xs: List[float],
    ys: List[float],
    width: int,
    height: int,
    base_padding: int,
    context_scale: float,
    min_crop_size: int,
) -> Tuple[int, int, int, int]:
    min_x = min(xs)
    max_x = max(xs)
    min_y = min(ys)
    max_y = max(ys)

    bbox_w = max_x - min_x
    bbox_h = max_y - min_y
    dynamic_padding = max(base_padding, int(max(bbox_w, bbox_h) * context_scale))

    center_x = (min_x + max_x) / 2.0
    center_y = (min_y + max_y) / 2.0
    side = max(min_crop_size, int(max(bbox_w, bbox_h) + (2 * dynamic_padding)))
    half = side / 2.0

    box = (
        int(round(center_x - half)),
        int(round(center_y - half)),
        int(round(center_x + half)),
        int(round(center_y + half)),
    )
    return clip_box(box[0], box[1], box[2], box[3], width, height)


def resolve_scene_geojson(scene_id: str, kind: str) -> Path:
    return GEOJSON_DIR / f"output_{scene_id}_{kind}_disaster.geojson"


def resolve_metadata_key(metadata: dict, scene_id: str, kind: str) -> Optional[str]:
    prefix = f"{scene_id}_{kind}_disaster"
    for key in metadata.keys():
        if key.startswith(prefix):
            return key
    return None


def scene_already_cropped(output_root: Path, scene_id: str) -> bool:
    pre_dir = output_root / f"{scene_id}_pre_disaster"
    post_dir = output_root / f"{scene_id}_post_disaster"
    return (
        pre_dir.exists()
        and post_dir.exists()
        and any(pre_dir.iterdir())
        and any(post_dir.iterdir())
    )


def crop_scene(
    scene_id: str,
    scene_images: SceneImages,
    metadata: dict,
    output_root: Path,
    base_padding: int,
    context_scale: float,
    min_crop_size: int,
) -> Tuple[int, int]:
    pre_geojson_path = resolve_scene_geojson(scene_id, "pre")
    post_geojson_path = resolve_scene_geojson(scene_id, "post")
    if not pre_geojson_path.exists() or not post_geojson_path.exists():
        raise FileNotFoundError(f"Missing GeoJSON for {scene_id}")

    pre_key = resolve_metadata_key(metadata, scene_id, "pre")
    post_key = resolve_metadata_key(metadata, scene_id, "post")
    if not pre_key or not post_key:
        raise KeyError(f"Missing metadata transform for {scene_id}")

    pre_transform = metadata[pre_key][0]
    post_transform = metadata[post_key][0]

    pre_img = download_image(scene_images.pre_url)
    post_img = download_image(scene_images.post_url)
    pre_width, pre_height = pre_img.size
    post_width, post_height = post_img.size

    pre_geojson = read_json(pre_geojson_path)
    post_geojson = read_json(post_geojson_path)
    pre_features = pre_geojson.get("features", [])
    post_features = post_geojson.get("features", [])
    if len(pre_features) != len(post_features):
        raise ValueError(
            f"Feature count mismatch for {scene_id}: pre={len(pre_features)} post={len(post_features)}"
        )

    pre_dir = output_root / f"{scene_id}_pre_disaster"
    post_dir = output_root / f"{scene_id}_post_disaster"
    pre_dir.mkdir(parents=True, exist_ok=True)
    post_dir.mkdir(parents=True, exist_ok=True)

    saved = 0
    skipped = 0

    for idx, (pre_feature, post_feature) in enumerate(zip(pre_features, post_features)):
        pre_coords = (pre_feature.get("geometry") or {}).get("coordinates", [])
        post_coords = (post_feature.get("geometry") or {}).get("coordinates", [])
        if not pre_coords or not post_coords:
            skipped += 1
            continue

        pre_ring = pre_coords[0]
        post_ring = post_coords[0]

        pre_pixels = [
            geo_to_pixel(
                lon,
                lat,
                pre_transform[0],
                pre_transform[1],
                pre_transform[3],
                pre_transform[5],
            )
            for lon, lat in pre_ring
        ]
        post_pixels = [
            geo_to_pixel(
                lon,
                lat,
                post_transform[0],
                post_transform[1],
                post_transform[3],
                post_transform[5],
            )
            for lon, lat in post_ring
        ]

        pre_xs = [p[0] for p in pre_pixels]
        pre_ys = [p[1] for p in pre_pixels]
        post_xs = [p[0] for p in post_pixels]
        post_ys = [p[1] for p in post_pixels]

        pre_box = build_context_box(
            pre_xs,
            pre_ys,
            pre_width,
            pre_height,
            base_padding,
            context_scale,
            min_crop_size,
        )
        post_box = build_context_box(
            post_xs,
            post_ys,
            post_width,
            post_height,
            base_padding,
            context_scale,
            min_crop_size,
        )

        if pre_box[2] <= pre_box[0] or pre_box[3] <= pre_box[1]:
            skipped += 1
            continue
        if post_box[2] <= post_box[0] or post_box[3] <= post_box[1]:
            skipped += 1
            continue

        pre_crop = pre_img.crop(pre_box)
        post_crop = post_img.crop(post_box)

        pre_crop.save(pre_dir / f"building_{idx}.png")
        post_crop.save(post_dir / f"building_{idx}.png")
        saved += 1

    return saved, skipped


def main() -> None:
    parser = argparse.ArgumentParser(description="Crop Cloudinary-hosted disaster scenes into building crops.")
    parser.add_argument("--urls-file", type=str, default=str(DEFAULT_URLS_FILE))
    parser.add_argument("--metadata-file", type=str, default=str(METADATA_FILE))
    parser.add_argument("--output-dir", type=str, default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--padding", type=int, default=PADDING, help="Minimum padding in pixels around each building footprint.")
    parser.add_argument(
        "--context-scale",
        type=float,
        default=CONTEXT_SCALE,
        help="Extra context added relative to the larger footprint dimension.",
    )
    parser.add_argument(
        "--min-crop-size",
        type=int,
        default=MIN_CROP_SIZE,
        help="Minimum square crop size in pixels.",
    )
    parser.add_argument(
        "--scene",
        action="append",
        default=[],
        help="Specific scene id to crop, e.g. hurricane-harvey_00000370. Repeat for multiple scenes.",
    )
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip scenes that already have both pre and post crop folders with content.",
    )
    args = parser.parse_args()

    urls_file = Path(args.urls_file)
    metadata_file = Path(args.metadata_file)
    output_root = Path(args.output_dir)

    metadata = read_json(metadata_file)
    scene_urls = load_scene_urls(urls_file)

    requested_scenes = list(args.scene) if args.scene else list(scene_urls.keys())
    missing_scenes = [scene for scene in requested_scenes if scene not in scene_urls]
    if missing_scenes:
        raise SystemExit(f"ERROR: missing URL pairs for scene(s): {', '.join(missing_scenes)}")

    total = len(requested_scenes)
    print(f"[INFO] found {total} scene(s) with pre/post URLs in {urls_file}")

    for index, scene_id in enumerate(requested_scenes, 1):
        if args.skip_existing and scene_already_cropped(output_root, scene_id):
            print(f"[{index}/{total}] {scene_id} ... SKIP existing crops")
            continue

        print(f"[{index}/{total}] {scene_id} ... downloading + cropping")
        try:
            saved, skipped = crop_scene(
                scene_id,
                scene_urls[scene_id],
                metadata,
                output_root,
                args.padding,
                args.context_scale,
                args.min_crop_size,
            )
        except Exception as exc:
            print(f"[{index}/{total}] {scene_id} ... ERROR {type(exc).__name__}: {exc}")
            continue

        print(f"[{index}/{total}] {scene_id} ... DONE saved={saved} skipped={skipped}")

    print(f"[DONE] output root: {output_root}")


if __name__ == "__main__":
    main()
