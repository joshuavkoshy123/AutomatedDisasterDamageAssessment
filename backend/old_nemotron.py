import os
import base64
from openai import OpenAI
import sys

# Initialize NVIDIA client
client = OpenAI(
  base_url = "https://integrate.api.nvidia.com/v1",
  api_key = "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"
)

def encode_image(image_path: str) -> str:
    """Read and base64-encode an image file."""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def send_to_nvidia_model(image_paths, prompt_text: str):
    """
    Send up to 4 images and a text prompt to NVIDIA multimodal model.
    """
    print("Sending images to NVIDIA model...")

    # Encode each image
    image_messages = [
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{encode_image(path)}"}}
        for path in image_paths[:4]
    ]

    # Prepare and send the request
    completion = client.chat.completions.create(
        model="nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
        messages=[
            {
                "role": "user",
                "content": image_messages + [
                    {"type": "text", "text": prompt_text}
                ]
            }
        ],
        temperature=0.7,
        top_p=0.9,
        max_tokens=1024,
        stream=True
    )

    print("Model response:\n")
    # for chunk in completion:
    #     if chunk.choices[0].delta.content:
    #         print(chunk.choices[0].delta.content, end="")

    lines = ""

    for chunk in completion:
        if chunk.choices[0].delta.content:
            text = chunk.choices[0].delta.content
            lines += text

    # Convert literal "\n" to actual newlines
    lines = lines.replace("\\n", "\n")
    
    return lines

image_paths = list(sys.argv[1:])
print(send_to_nvidia_model(image_paths, "Can you identify each building in the images and tell me the damage assessment of each based on the mapping provided in hurricane-harvey_00000003_pre_disaster_mapping.png and hurricane-harvey_00000003_pre_disaster.png and hurricane-harvey_00000003_post_disaster.png images? You can list it out or put it in json format. Give each building a rating of no-damage, minor-damage, major-damage, or severe-damage. The number of buildings should match that of the mapping (37) so group as needed."))
