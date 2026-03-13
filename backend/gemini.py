from google import genai
import os
from dotenv import load_dotenv
from google.genai import types

load_dotenv()

client = genai.Client()

# Upload the first image
image1_path = "..\outputs\crops\hurricane-harvey_00000003\image1.jpg"
uploaded_file = client.files.upload(file=image1_path)

# Prepare the second image as inline data
image2_path = "..\outputs\crops\hurricane-harvey_00000003\image2.jpg"
# with open(image2_path, 'rb') as f:
#     img2_bytes = f.read()
uploaded_file_2 = client.files.upload(file=image2_path)

# Upload the third image
# image3_path = "..\mappings\hurricane-harvey_00000003_pre_disaster_mapping.png"
# uploaded_file_3 = client.files.upload(file=image3_path)

# Create the prompt with text and multiple images
response = client.models.generate_content(

    model="gemini-3-flash-preview",
    contents=[
        "Can you provide a damage assessment of the before (1) and after (2) building. Give the building a rating of no-damage, minor-damage, major-damage, or severe-damage (only use these ratings). Be sure to use the images to make your assessment, not any prior knowledge or extra context.",
        uploaded_file,  # Use the uploaded file reference
        # uploaded_file_3,
        # types.Part.from_bytes(
        #     data=img2_bytes,
        #     mime_type='image/png'
        # )
        uploaded_file_2
    ]
)

print(response.text)