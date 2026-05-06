import os
import pandas as pd

# Base directory
base_dir = "building_crops/_predictions"

# Columns you want
columns_to_keep = ["uid", "expected", "predicted", "match"]

# List to store DataFrames
dfs = []

# Walk through all subdirectories
for root, dirs, files in os.walk(base_dir):
    # Skip the root _predictions folder
    if root == base_dir:
        continue

    if "results_secondary_v7.csv" in files:
        file_path = os.path.join(root, "results_secondary_v7.csv")
        
        try:
            df = pd.read_csv(file_path)
            
            # Extract folder name (last part of the path)
            folder_name = os.path.basename(root)
            
            # Keep only desired columns (if they exist)
            df = df[[col for col in columns_to_keep if col in df.columns]]
            
            # Add folder_name column
            df["folder_name"] = folder_name
            
            dfs.append(df)
            print(f"Loaded: {file_path}")
        
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

# Combine all DataFrames
if dfs:
    final_df = pd.concat(dfs, ignore_index=True)
    
    # Optional: reorder columns
    final_df = final_df[["folder_name"] + columns_to_keep]
else:
    print("No CSV files found.")

# add address info
addresses_path = os.path.join("outputs", "addresses", "building_addresses.csv")

address_cols = [
    "uid",  # needed for merge
    "latitude", "longitude", "street_address", "house_number",
    "road", "city", "county", "state", "postcode",
    "country", "display_name"
]

try:
    addr_df = pd.read_csv(addresses_path)

    addr_df["postcode"] = addr_df["postcode"].astype(str).str.extract(r"(\d{5})")[0]

    # Keep only needed columns
    addr_df = addr_df[[col for col in address_cols if col in addr_df.columns]]

    # Merge on uid
    final_df = final_df.merge(addr_df, on="uid", how="left")

    # Remove duplicate rows based on uid
    final_df = final_df.drop_duplicates(subset=["uid"])

    print("Successfully merged address data.")

    # Output file
    output_path = os.path.join(base_dir, "final_results.csv")

    final_df.to_csv(output_path, index=False)

    print(f"Final file saved to: {output_path}")

except Exception as e:
    print(f"Error loading addresses file: {e}")