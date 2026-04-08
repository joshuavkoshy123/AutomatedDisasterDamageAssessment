from io import BytesIO
import json
import os
from urllib.parse import urlparse

import requests
from PIL import Image

# -----------------------------
# CONFIG
# -----------------------------
#IMAGE_DIR = "../images"
GEOJSON_DIR = "GeoJSON"
METADATA_FILE = "metadata.json"
OUTPUT_DIR = "../building_crops"

image_names = ["hurricane-harvey_00000003_pre_disaster.png", "hurricane-harvey_00000003_post_disaster.png", "hurricane-harvey_00000011_pre_disaster.png", "hurricane-harvey_00000011_post_disaster.png", "hurricane-harvey_00000018_pre_disaster.png", "hurricane-harvey_00000018_post_disaster.png", "hurricane-harvey_00000023_pre_disaster.png", "hurricane-harvey_00000023_post_disaster.png", "hurricane-harvey_00000033_pre_disaster.png", "hurricane-harvey_00000033_post_disaster.png"]

# add padding around cropped images
PADDING = 30

os.makedirs(OUTPUT_DIR, exist_ok=True)

# -----------------------------
# LOAD METADATA
# -----------------------------
with open(METADATA_FILE) as f:
    metadata = json.load(f)

# -----------------------------
# GEO → PIXEL CONVERSION
# -----------------------------
# Convert geolocation to pixel coordinate
def geo_to_pixel(lon, lat, startX, pixelWidth, startY, pixelHeight):
    x = (lon - startX) / pixelWidth
    y = (lat - startY) / pixelHeight
    return x, y

# -----------------------------
# PROCESS EACH IMAGE
# -----------------------------
#for image_name in image_names:
with open('image_urls.txt', 'r') as urls:
    for url in urls:

        # create image path
        image_name = os.path.basename(urlparse(url).path)

        name, ext = os.path.splitext(image_name)

        clean_name = "_".join(name.split("_")[:4])  # adjust based on your pattern

        image_name = clean_name + ext

        # skip if image does not exist
        # if not os.path.exists(url):
        #     continue

        print("Processing:", image_name)

        # Load image
        response = requests.get(url)
        image = Image.open(BytesIO(response.content))

        # store image dimensions
        width, height = image.size

        # Get affine transform
        transform = metadata[image_name][0]

        startX = transform[0]
        pixelWidth = transform[1]
        startY = transform[3]
        pixelHeight = transform[5]

        # Determine GeoJSON file
        base_name = image_name.replace(".png", "")
        geojson_path = os.path.join(GEOJSON_DIR, "output_" + base_name + ".geojson")

        if not os.path.exists(geojson_path):
            print("Missing GeoJSON:", geojson_path)
            continue

        with open(geojson_path) as f:
            geojson = json.load(f)

        # -----------------------------
        # PROCESS BUILDINGS
        # -----------------------------
        for i, feature in enumerate(geojson["features"]):

            coords = feature["geometry"]["coordinates"][0]

            pixel_coords = []

            # convert GeoJSON latitude/longitude into pixel coordinates
            for lon, lat in coords:
                x, y = geo_to_pixel(
                    lon, lat,
                    startX, pixelWidth,
                    startY, pixelHeight
                )
                pixel_coords.append((x, y))

            # store x and y coordinates
            xs = [p[0] for p in pixel_coords]
            ys = [p[1] for p in pixel_coords]

            # apply padding
            minX = int(min(xs)) - PADDING
            maxX = int(max(xs)) + PADDING
            minY = int(min(ys)) - PADDING
            maxY = int(max(ys)) + PADDING

            # Clip to image bounds
            minX = max(0, minX)
            minY = max(0, minY)
            maxX = min(width, maxX)
            maxY = min(height, maxY)

            # skip invalid crops
            if maxX <= minX or maxY <= minY:
                continue

            # crop image
            crop = image.crop((minX, minY, maxX, maxY))

            # add to output directory
            tile_output_dir = os.path.join(OUTPUT_DIR, base_name)
            os.makedirs(tile_output_dir, exist_ok=True)

            output_name = f"building_{i}.png"
            output_path = os.path.join(tile_output_dir, output_name)

            crop.save(output_path)

print("Done.")