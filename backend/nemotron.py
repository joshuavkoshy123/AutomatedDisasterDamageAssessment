
import requests
import os
import base64
import sys

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False
query = "Can you provide a damage assessment of each building based on the mapping provided in mappings/hurricane-harvey_00000003_pre_disaster_mapping.png and images/hurricane-harvey_00000003_pre_disaster.png and images/hurricane-harvey_00000003_post_disaster.png images? You can list it out or put it in json format. Give each building a rating of minor-damage, major-damage, or severe-damage. The number of buildings should match that of the mapping (37) so group as needed."
kApiKey = "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"

# ext: {mime, media_type}
kSupportedList = {
    "png": ["image/png", "image_url"],
    "jpg": ["image/jpeg", "image_url"],
    "jpeg": ["image/jpeg", "image_url"],
    "webp": ["image/webp", "image_url"],
    "mp4": ["video/mp4", "video_url"],
    "webm": ["video/webm", "video_url"],
    "mov": ["video/mov", "video_url"]
}

def get_extension(filename):
    _, ext = os.path.splitext(filename)
    ext = ext[1:].lower()
    return ext

def mime_type(ext):
    return kSupportedList[ext][0]

def media_type(ext):
    return kSupportedList[ext][1]

def encode_media_base64(media_file):
    """Encode media file to base64 string"""
    with open(media_file, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")

def chat_with_media(infer_url, media_files, query: str, stream: bool = False):
    assert isinstance(media_files, list), f"{media_files}"
    
    has_video = False
    
    # Build content based on whether we have media files
    if len(media_files) == 0:
        # Text-only mode
        content = query
    else:
        # Build content array with text and media
        content = [{"type": "text", "text": query}]
        
        for media_file in media_files:
            ext = get_extension(media_file)
            assert ext in kSupportedList, f"{media_file} format is not supported"
            
            media_type_key = media_type(ext)
            if media_type_key == "video_url":
                has_video = True
            
            print(f"Encoding {media_file} as base64...")
            base64_data = encode_media_base64(media_file)
            
            # Add media to content array
            media_obj = {
                "type": media_type_key,
                media_type_key: {
                    "url": f"data:{mime_type(ext)};base64,{base64_data}"
                }
            }
            content.append(media_obj)
        
        if has_video:
            assert len(media_files) == 1, "Only single video supported."
    
    headers = {
        "Authorization": f"Bearer {kApiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if stream:
        headers["Accept"] = "text/event-stream"

    # Add system message with appropriate prompt
    # Videos only support /no_think, images support both
    
    system_prompt = "/no_think" if has_video else "/think"
    
    
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": content,
        }
    ]
    payload = {
        "max_tokens": 4096,
        "temperature": 1,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "messages": messages,
        "stream": stream,
        "model": "nvidia/nemotron-nano-12b-v2-vl",
    }

    response = requests.post(infer_url, headers=headers, json=payload, stream=stream)
    if stream:
        for line in response.iter_lines():
            if line:
                print(line.decode("utf-8"))
    else:
        print(response.json()["choices"][0]["message"]["content"])

if __name__ == "__main__":
    """ Usage:
        python test.py                                    # Text-only
        python test.py sample.mp4                         # Single video
        python test.py sample1.png sample2.png            # Multiple images
    """

    media_samples = list(sys.argv[1:])
    chat_with_media(invoke_url, media_samples, query, stream)