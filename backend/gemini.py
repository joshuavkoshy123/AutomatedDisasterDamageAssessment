from google import genai
import os
from dotenv import load_dotenv
from google.genai import types

load_dotenv()

client = genai.Client()

# Upload the first image
image1_path = "..\images\hurricane-harvey_00000003_pre_disaster.png"
uploaded_file = client.files.upload(file=image1_path)

# Prepare the second image as inline data
image2_path = "..\images\hurricane-harvey_00000003_post_disaster.png"
with open(image2_path, 'rb') as f:
    img2_bytes = f.read()

# Upload the third image
image3_path = "..\mappings\hurricane-harvey_00000003_pre_disaster_mapping.png"
uploaded_file_3 = client.files.upload(file=image3_path)

# Create the prompt with text and multiple images
response = client.models.generate_content(

    model="gemini-3-flash-preview",
    contents=[
        "Can you provide a damage assessment of each building based on the mapping provided in mappings/hurricane-harvey_00000003_pre_disaster_mapping.png and images/hurricane-harvey_00000003_pre_disaster.png and images/hurricane-harvey_00000003_post_disaster.png images? You can list it out or put it in json format. Give each building a rating of no-damage, minor-damage, major-damage, or severe-damage (only use these ratings). The number of buildings should match that of the mapping (37) so group as needed. Be sure to use the images to make your assessment, not any prior knowledge or extra context.",
        uploaded_file,  # Use the uploaded file reference
        uploaded_file_3,
        types.Part.from_bytes(
            data=img2_bytes,
            mime_type='image/png'
        )
    ]
)

print(response.text)