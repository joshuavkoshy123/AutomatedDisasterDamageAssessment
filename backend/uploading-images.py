#!/usr/bin/env python3
"""
Load pre/post disaster GeoJSON label files into Firestore collections.

Creates two collections:
  - pre_disaster_labels
  - post_disaster_labels
"""

import json
from pathlib import Path

import firebase_admin
from firebase_admin import credentials, firestore

# --- Config ---------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent

GEOJSON_DIR = (SCRIPT_DIR.parent / "./GeoJSON").resolve()

# Labels uwu
PRE_COLLECTION = "pre_disaster_labels"
POST_COLLECTION = "post_disaster_labels"

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

    pre_count, post_count = 0, 0

    for path in sorted(folder.glob("*.geojson")):
        name = path.name.lower()
        try:
            data = load_json(path)
        except json.JSONDecodeError as e:
            print(f"  ! Skipping {path.name}: invalid JSON ({e})")
            continue

        # Store as a JSON string to avoid Firestore's nested array limitation
        doc = {
            "_source_file": path.name,
            "data": json.dumps(data),
        }

        if "pre_disaster" in name:
            db.collection(PRE_COLLECTION).document(path.stem).set(doc)
            pre_count += 1
        elif "post_disaster" in name:
            db.collection(POST_COLLECTION).document(path.stem).set(doc)
            post_count += 1
        else:
            print(f"  ? Skipping {path.name}: neither pre_ nor post_disaster")

    print(f"Inserted {pre_count} docs into '{PRE_COLLECTION}'")
    print(f"Inserted {post_count} docs into '{POST_COLLECTION}'")


def main() -> None:
    print(f"Loading GeoJSON from {GEOJSON_DIR}")
    ingest(GEOJSON_DIR)
    print("Done.")


if __name__ == "__main__":
    main()
