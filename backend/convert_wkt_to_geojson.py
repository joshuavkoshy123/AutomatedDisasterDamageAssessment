import json

INPUT_FILE = "../labels/hurricane-harvey_00000033_post_disaster.json"
OUTPUT_FILE = "output_hurricane-harvey_000000033_post_disaster.geojson"


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

    id = 1
    for item in input_data["features"]["lng_lat"]:
        geometry = {
            "type": "Polygon",
            "coordinates": wkt_polygon_to_geojson_coords(item["wkt"])
        }

        item["properties"].update({"id": id})
        print(item["properties"])
        feature = {
            "type": "Feature",
            "properties": item["properties"],
            "geometry": geometry
        }

        features_out.append(feature)
        id += 1

    geojson = {
        "type": "FeatureCollection",
        "features": features_out
    }

    with open(output_path, "w") as f:
        json.dump(geojson, f, indent=2)

    print(f"✅ Converted {len(features_out)} features to {output_path}")


if __name__ == "__main__":
    convert_file_to_geojson(INPUT_FILE, OUTPUT_FILE)
