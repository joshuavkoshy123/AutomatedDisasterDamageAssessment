import os
import pandas as pd

# Base directory
base_dir = "building_crops/_predictions"

# Walk through all subdirectories
i = 0
for root, dirs, files in os.walk(base_dir):
    # Skip the root _predictions folder
    if root == base_dir:
        continue
    
    # Extract folder name (last part of the path)
    folder_name = os.path.basename(root)

    print("'" + folder_name.split("_")[-1] + "'", end=", ")
    i += 1

print(f"/n Count: {i}")