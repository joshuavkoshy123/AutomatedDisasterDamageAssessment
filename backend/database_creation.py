import json
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv()

# connect to database
print(os.getenv("DATABASE_URL"))
conn = psycopg2.connect(
    os.getenv("DATABASE_URL")
)

cursor = conn.cursor()

geojson_dir = Path("GeoJSON")
CROPS_DIR = "../building_crops"

# delete existing entries in tables for fresh start
cursor.execute("""DELETE FROM PRE_DISASTER_LABELS;""")
conn.commit()
cursor.execute("""DELETE FROM POST_DISASTER_LABELS;""")
conn.commit()
cursor.execute("""DELETE FROM "DISASTERS";""")
conn.commit()

for file in geojson_dir.iterdir():
    if file.is_file() and "pre" in file.name:
        with open(file) as f:
            pre_geojson = json.load(f)
            print(file.name)
            filename = file.name
            filestem = file.stem
            parts = filename.split('_')
            disaster_id = parts[2]
            image_name = parts[1] + "_" + parts[2]

            # populate disasters table
            cursor.execute("""INSERT INTO "DISASTERS"
                            (disaster_id, pre_disaster_image_url, post_disaster_image_url)
                                VALUES (%s, %s, %s)
                                """,
                                (disaster_id, f"images/{image_name}_pre_disaster.png", f"images/{image_name}_post_disaster.png")
                            )

            try:
                conn.commit()
            except Exception as e:
                conn.rollback()
                print("Error:", e)

            # populate pre_disaster_labels table
            for i, feature in enumerate(pre_geojson["features"]):

                building_id = feature["properties"]["id"]
                uid = feature["properties"]["uid"]
                footprint = json.dumps(feature["geometry"])
                cropped_image_url = os.path.join(CROPS_DIR, f"{image_name}_pre_disaster/building_{i}.png")
                #print(footprint, "\n\n")
                cursor.execute("""INSERT INTO PRE_DISASTER_LABELS
                            (disaster_id, building_id, uid, footprint, cropped_image_url)
                                VALUES (%s, %s, %s, %s, %s)
                                """,
                                (disaster_id, building_id, uid, footprint, cropped_image_url)
                            )

            try:
                conn.commit()
            except Exception as e:
                conn.rollback()
                print("Error:", e)

for file in geojson_dir.iterdir():
    if file.is_file() and "post" in file.name:
        with open(file) as f:
            post_geojson = json.load(f)
            print(file.name)
            filename = file.name
            filestem = file.stem
            parts = filename.split('_')
            disaster_id = parts[2]
            image_name = parts[1] + "_" + parts[2]

            # populate post_disaster_labels table
            for i, feature in enumerate(post_geojson["features"]):

                building_id = feature["properties"]["id"]
                uid = feature["properties"]["uid"]
                damage_type = feature["properties"]["subtype"]
                footprint = json.dumps(feature["geometry"])
                cropped_image_url = os.path.join(CROPS_DIR, f"{image_name}_post_disaster/building_{i}.png")
                #print(footprint, "\n\n")
                cursor.execute("""INSERT INTO POST_DISASTER_LABELS
                            (disaster_id, building_id, uid, damage_type, footprint, cropped_image_url)
                                VALUES (%s, %s, %s, %s, %s, %s)
                                """,
                                (disaster_id, building_id, uid, damage_type, footprint, cropped_image_url)
                            )
                
            try:
                conn.commit()
            except Exception as e:
                conn.rollback()
                print("Error:", e)

cursor.close()
conn.close()