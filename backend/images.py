import os
from dotenv import load_dotenv
import cloudinary
import cloudinary.api

load_dotenv()
url = os.getenv("CLOUDINARY_URL")
print("ENV:", url)

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

print("Cloud name:", cloudinary.config().cloud_name)

resources = cloudinary.api.resources(max_results=500)

with open("image_urls.txt", "w") as f:
    for r in resources["resources"]:
        print(r["secure_url"])
        f.write(r["secure_url"] + "\n")