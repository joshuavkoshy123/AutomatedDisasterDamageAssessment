#!/usr/bin/env python3
"""
Load pre/post disaster GeoJSON label files into Firestore collections.

Creates two collections:
  - pre_disaster_labels
  - post_disaster_labels
"""

import json
from pathlib import Path
import sys

import firebase_admin
from firebase_admin import credentials, firestore

# --- Config ---------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent

GEOJSON_DIR = (SCRIPT_DIR.parent / "building_crops/_predictions").resolve()

# Labels
PREDICTIONS_COLLECTION = "prediction_labels"

# --- Firebase init --------------------------------------------------------

# ADD YOUR .JSON file here
cred = credentials.Certificate("./addas-8f505-firebase-adminsdk-fbsvc-49c0193479.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def ingest(folder: Path) -> None:
    if not folder.is_dir():
        print(f"GeoJSON folder not found: {folder}")
        return

    count = 0

    for subfolder in sorted(folder.iterdir()):
        if not subfolder.is_dir():
            continue

        path = subfolder / "predictions_secondary_v7.geojson"

        if not path.exists():
            continue
        name = path.name.lower()
        try:
            data = load_json(path)
            size_kb = sys.getsizeof(json.dumps(data)) / 1024
            print(f"{subfolder.name}: {size_kb:.2f} KB")
        except json.JSONDecodeError as e:
            print(f"  ! Skipping {path.name}: invalid JSON ({e})")
            continue

        # Store as a JSON string to avoid Firestore's nested array limitation
        doc = {
            "_source_file": path.name,
            "folder": subfolder.name,
            "data": json.dumps(data),
        }

        db.collection(PREDICTIONS_COLLECTION).document(subfolder.name).set(doc)
        count += 1

    print(f"Inserted {count} docs into '{PREDICTIONS_COLLECTION}'")


def main() -> None:
    print(f"Loading GeoJSON from {GEOJSON_DIR}")
    ingest(GEOJSON_DIR)
    print("Done.")


if __name__ == "__main__":
    main()
