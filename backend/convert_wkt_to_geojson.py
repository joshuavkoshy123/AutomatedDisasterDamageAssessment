import json

INPUT_FILE = "../labels/hurricane-harvey_00000003_post_disaster.json"
OUTPUT_FILE = "output_hurricane-harvey_00000003_post_disaster.geojson"


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

    for item in input_data["features"]["lng_lat"]:
        geometry = {
            "type": "Polygon",
            "coordinates": wkt_polygon_to_geojson_coords(item["wkt"])
        }

        feature = {
            "type": "Feature",
            "properties": item["properties"],
            "geometry": geometry
        }

        features_out.append(feature)

    geojson = {
        "type": "FeatureCollection",
        "features": features_out
    }

    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)

    print(f"✅ Converted {len(features_out)} features to {output_path}")


if __name__ == "__main__":
    convert_file_to_geojson(INPUT_FILE, OUTPUT_FILE)
