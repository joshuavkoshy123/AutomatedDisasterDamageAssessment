import json
import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path
import pandas as pd

load_dotenv()

predictions_path = Path("building_crops/_predictions/final_results.csv")

df = pd.read_csv(predictions_path)
print(df.head())

df["postcode"] = df["postcode"].astype(str).str.extract(r"(\d{5})")[0]

# connect to database
print(os.getenv("DATABASE_URL"))
conn = psycopg2.connect(
    os.getenv("DATABASE_URL")
)

cursor = conn.cursor()

# delete existing entries in tables for fresh start
cursor.execute("""DELETE FROM PREDICTIONS;""")
conn.commit()

for _, row in df.iterrows():
    cursor.execute("""
INSERT INTO predictions (
    disaster_id, uid, expected, predicted, match,
    latitude, longitude,
    street_address, house_number, road, city,
    county, state, postcode, country, display_name
) VALUES (
    %s, %s, %s, %s, %s,
    %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s, %s
)
""", (
        row["folder_name"],
        row["uid"],
        row["expected"],
        row["predicted"],
        row["match"],

        row["latitude"],
        row["longitude"],

        row["street_address"],
        row["house_number"],
        row["road"],
        row["city"],
        row["county"],
        row["state"],
        row["postcode"],
        row["country"],
        row["display_name"]
    ))

conn.commit()
cursor.close()
conn.close()

print("CSV successfully loaded into database.")