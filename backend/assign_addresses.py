from __future__ import annotations

import argparse
import csv
import json
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import requests


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LABELS_GLOB = "labels/*_post_disaster.json"
DEFAULT_OUTPUT_CSV = REPO_ROOT / "outputs" / "addresses" / "building_addresses.csv"
DEFAULT_OUTPUT_JSON = REPO_ROOT / "outputs" / "addresses" / "building_addresses.json"
DEFAULT_CACHE_JSON = REPO_ROOT / "outputs" / "addresses" / "address_cache.json"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "AutomatedDisasterDamageAssessment/1.0 (address-enrichment)"

WKT_POLY_RE = re.compile(
    r"POLYGON\s*\(\(\s*(?P<body>.+?)\s*\)\)\s*$",
    flags=re.IGNORECASE | re.DOTALL,
)


@dataclass
class BuildingRecord:
    uid: str
    subtype: str
    scene_id: str
    latitude: float
    longitude: float


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def parse_polygon_wkt_lng_lat(wkt: str) -> List[Tuple[float, float]]:
    match = WKT_POLY_RE.match(wkt.strip())
    if not match:
        raise ValueError(f"Unsupported WKT polygon: {wkt[:80]}...")

    points: List[Tuple[float, float]] = []
    for chunk in match.group("body").split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        parts = chunk.split()
        if len(parts) < 2:
            continue
        lon = float(parts[0])
        lat = float(parts[1])
        points.append((lon, lat))

    if len(points) < 3:
        raise ValueError(f"Polygon has too few points: {wkt[:80]}...")
    return points


def polygon_centroid(points: List[Tuple[float, float]]) -> Tuple[float, float]:
    if len(points) >= 2 and points[0] == points[-1]:
        points = points[:-1]

    area_twice = 0.0
    centroid_x = 0.0
    centroid_y = 0.0

    for i in range(len(points)):
        x0, y0 = points[i]
        x1, y1 = points[(i + 1) % len(points)]
        cross = x0 * y1 - x1 * y0
        area_twice += cross
        centroid_x += (x0 + x1) * cross
        centroid_y += (y0 + y1) * cross

    if abs(area_twice) < 1e-12:
        avg_lon = sum(p[0] for p in points) / len(points)
        avg_lat = sum(p[1] for p in points) / len(points)
        return avg_lon, avg_lat

    area = area_twice / 2.0
    centroid_x /= 6.0 * area
    centroid_y /= 6.0 * area
    return centroid_x, centroid_y


def scene_id_from_labels_json(path: Path, data: dict) -> str:
    img_name = ((data.get("metadata") or {}).get("img_name") or path.stem)
    stem = Path(img_name).stem
    for suffix in ["_post_disaster", "_pre_disaster", "_post", "_pre"]:
        if stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def iter_buildings(label_paths: Iterable[Path]) -> List[BuildingRecord]:
    records: List[BuildingRecord] = []
    for path in sorted(label_paths):
        data = read_json(path)
        scene_id = scene_id_from_labels_json(path, data)
        features = (data.get("features") or {}).get("lng_lat") or []
        for feature in features:
            props = feature.get("properties", {})
            uid = str(props.get("uid", "")).strip()
            subtype = str(props.get("subtype", "")).strip()
            wkt = feature.get("wkt")
            if not uid or not wkt:
                continue
            points = parse_polygon_wkt_lng_lat(wkt)
            lon, lat = polygon_centroid(points)
            records.append(
                BuildingRecord(
                    uid=uid,
                    subtype=subtype,
                    scene_id=scene_id,
                    latitude=lat,
                    longitude=lon,
                )
            )
    return records


def load_cache(cache_path: Path) -> Dict[str, dict]:
    if not cache_path.exists():
        return {}
    return read_json(cache_path)


def cache_key(lat: float, lon: float) -> str:
    return f"{lat:.7f},{lon:.7f}"


def reverse_geocode_nominatim(
    lat: float,
    lon: float,
    *,
    email: Optional[str],
    timeout_s: int = 20,
) -> dict:
    params = {
        "lat": f"{lat:.7f}",
        "lon": f"{lon:.7f}",
        "format": "jsonv2",
        "addressdetails": 1,
        "zoom": 18,
    }
    if email:
        params["email"] = email

    response = requests.get(
        NOMINATIM_REVERSE_URL,
        params=params,
        headers={"User-Agent": USER_AGENT},
        timeout=timeout_s,
    )
    response.raise_for_status()
    return response.json()


def normalize_address_fields(result: dict) -> dict:
    address = result.get("address") or {}
    house_number = address.get("house_number", "")
    road = address.get("road") or address.get("pedestrian") or address.get("residential") or ""
    city = (
        address.get("city")
        or address.get("town")
        or address.get("village")
        or address.get("hamlet")
        or ""
    )
    county = address.get("county", "")
    state = address.get("state", "")
    postcode = address.get("postcode", "")
    country = address.get("country", "")

    street_address = " ".join(part for part in [house_number, road] if part).strip()

    return {
        "street_address": street_address,
        "house_number": house_number,
        "road": road,
        "city": city,
        "county": county,
        "state": state,
        "postcode": postcode,
        "country": country,
        "display_name": result.get("display_name", ""),
    }


def enrich_records(
    records: List[BuildingRecord],
    *,
    cache_path: Path,
    email: Optional[str],
    min_interval_s: float,
) -> List[dict]:
    cache = load_cache(cache_path)
    enriched: List[dict] = []
    last_request_at = 0.0

    for index, record in enumerate(records, 1):
        key = cache_key(record.latitude, record.longitude)

        if key not in cache:
            wait_s = min_interval_s - (time.time() - last_request_at)
            if wait_s > 0:
                time.sleep(wait_s)

            try:
                cache[key] = reverse_geocode_nominatim(
                    record.latitude,
                    record.longitude,
                    email=email,
                )
            except requests.RequestException as exc:
                cache[key] = {
                    "_error": f"{type(exc).__name__}: {exc}",
                    "address": {},
                    "display_name": "",
                }
            last_request_at = time.time()
            write_json(cache_path, cache)

        geocode_result = cache[key]
        normalized = normalize_address_fields(geocode_result)
        row = {
            "uid": record.uid,
            "scene_id": record.scene_id,
            "damage_label": record.subtype,
            "latitude": round(record.latitude, 7),
            "longitude": round(record.longitude, 7),
            "street_address": normalized["street_address"],
            "house_number": normalized["house_number"],
            "road": normalized["road"],
            "city": normalized["city"],
            "county": normalized["county"],
            "state": normalized["state"],
            "postcode": normalized["postcode"],
            "country": normalized["country"],
            "display_name": normalized["display_name"],
            "geocoder_source": "nominatim",
            "geocoder_error": geocode_result.get("_error", ""),
        }
        enriched.append(row)

        if index % 50 == 0 or index == len(records):
            print(f"[PROGRESS] enriched {index}/{len(records)} buildings")

    return enriched


def write_csv(path: Path, rows: List[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with path.open("w", encoding="utf-8", newline="") as f:
            f.write("")
        return

    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reverse-geocode building centroids from labels JSON into DB-ready street addresses."
    )
    parser.add_argument(
        "--labels-glob",
        default=DEFAULT_LABELS_GLOB,
        help=f"Glob for input label files (default: {DEFAULT_LABELS_GLOB})",
    )
    parser.add_argument(
        "--out-csv",
        default=str(DEFAULT_OUTPUT_CSV),
        help=f"CSV output path (default: {DEFAULT_OUTPUT_CSV})",
    )
    parser.add_argument(
        "--out-json",
        default=str(DEFAULT_OUTPUT_JSON),
        help=f"JSON output path (default: {DEFAULT_OUTPUT_JSON})",
    )
    parser.add_argument(
        "--cache-json",
        default=str(DEFAULT_CACHE_JSON),
        help=f"Persistent geocode cache path (default: {DEFAULT_CACHE_JSON})",
    )
    parser.add_argument(
        "--email",
        default=os.getenv("NOMINATIM_EMAIL"),
        help="Optional contact email to send with reverse-geocoding requests.",
    )
    parser.add_argument(
        "--min-interval-s",
        type=float,
        default=1.1,
        help="Minimum delay between reverse-geocoding requests.",
    )
    args = parser.parse_args()

    label_paths = list(REPO_ROOT.glob(args.labels_glob))
    if not label_paths:
        raise SystemExit(f"No label files matched: {args.labels_glob}")

    records = iter_buildings(label_paths)
    print(f"[INFO] loaded {len(records)} building centroid records from {len(label_paths)} label files")

    rows = enrich_records(
        records,
        cache_path=Path(args.cache_json),
        email=args.email,
        min_interval_s=max(args.min_interval_s, 0.0),
    )

    write_csv(Path(args.out_csv), rows)
    write_json(Path(args.out_json), rows)
    print(f"[DONE] wrote CSV to {args.out_csv}")
    print(f"[DONE] wrote JSON to {args.out_json}")


if __name__ == "__main__":
    main()
