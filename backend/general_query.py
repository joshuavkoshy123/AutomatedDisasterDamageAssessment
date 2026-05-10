
import requests
import os
from dotenv import load_dotenv

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False
query = "Tell me about Hurricane Harvey"

load_dotenv()

kApiKey = os.getenv("NVIDIA_API_KEY")

def general_chat(query: str, history: list[dict] | None = None):
    
    infer_url = invoke_url

    headers = {
        "Authorization": f"Bearer {kApiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Add system message with appropriate prompt
    # Videos only support /no_think, images support both
    
    system_prompt = (
        "Answer concisely and to the point. "
        "Use prior conversation only when it is relevant to the user's current Hurricane Harvey question. "
        "Refuse anything outside Hurricane Harvey or the disaster assessment dataset."
    )

    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for turn in history or []:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})

    messages.append(
        {
            "role": "user",
            "content": query,
        }
    )

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
