
import requests
import os
import base64
import sys
from dotenv import load_dotenv

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False
query = "Tell me about Hurricane Harvey"

load_dotenv()

kApiKey = os.getenv("NVIDIA_API_KEY")

def general_chat(query: str):
    
    infer_url = invoke_url

    content = query
    
    headers = {
        "Authorization": f"Bearer {kApiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Add system message with appropriate prompt
    # Videos only support /no_think, images support both
    
    system_prompt = "Answer consisely and to the point, without providing more information than is necessary to answer the query."
    
    
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
        "max_tokens": 1024,
        "temperature": 1,
        "top_p": 1,
        "frequency_penalty": 0,
        "presence_penalty": 0,
        "messages": messages,
        "stream": stream,
        "model": "nvidia/nemotron-nano-12b-v2-vl",
    }

    response = requests.post(infer_url, headers=headers, json=payload, stream=stream)
    
    data = response.json()

    content = data['choices'][0]['message']['content']

    return(content)

if __name__ == "__main__":
    """ Usage:
        python general_query.py                                    # Text-only
    """

    general_chat(query)
