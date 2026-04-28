import json
from pathlib import Path

BASE_DIR = Path("building_crops/_predictions")


def wkt_polygon_to_geojson_coords(wkt_str):
    coords_text = wkt_str.replace("POLYGON ((", "").replace("))", "")
    coords = []
    for pair in coords_text.split(","):
        x, y = pair.strip().split()
        coords.append([float(x), float(y)])
    return [coords]


def convert_file_to_geojson(input_path, output_path):
    with open(input_path, "r") as f:
        input_data = json.load(f)

    features_out = []

    id_counter = 1
    for item in input_data["features"]["lng_lat"]:
        geometry = {
            "type": "Polygon",
            "coordinates": wkt_polygon_to_geojson_coords(item["wkt"])
        }

        item["properties"].update({"id": id_counter})

        feature = {
            "type": "Feature",
            "properties": item["properties"],
            "geometry": geometry
        }

        features_out.append(feature)
        id_counter += 1

    geojson = {
        "type": "FeatureCollection",
        "features": features_out
    }

    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)

    print(f"✅ Created: {output_path}")


if __name__ == "__main__":
    for subfolder in BASE_DIR.iterdir():
        if subfolder.is_dir():
            input_file = subfolder / "predictions_secondary_v7.json"

            if not input_file.exists():
                continue

            # ✅ EXACT filename you want
            output_file = input_file.with_suffix(".geojson")

            convert_file_to_geojson(input_file, output_file)