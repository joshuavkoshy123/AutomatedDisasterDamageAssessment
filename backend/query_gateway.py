import json
import os
import re
from collections import defaultdict, deque

import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from backend.RAG import general_query
from backend.csv_agent import query_csv_agent_with_history

load_dotenv()

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False
kApiKey = os.getenv("NVIDIA_API_KEY")
MAX_HISTORY_TURNS = 8
conversation_store: dict[str, deque] = defaultdict(lambda: deque(maxlen=MAX_HISTORY_TURNS * 2))


def clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text)
    text = re.sub(r"```$", "", text)
    return text.strip()


def get_session_history(session_id: str | None) -> list[dict]:
    if not session_id:
        return []
    return list(conversation_store[session_id])


def append_session_turn(session_id: str | None, role: str, content: str) -> None:
    if not session_id or not content:
        return
    conversation_store[session_id].append({"role": role, "content": content})


def build_response_payload(response: str, coordinates: dict | None = None) -> dict:
    return {
        "response": response,
        "coordinates": coordinates,
    }


class IntentDetection(BaseModel):
    intent: str = Field(
        description="The identified intent of the user query. Default to 'Unrelated' if no suitable enum is found.",
        enum=["HurricaneHarveyGeneral", "Hurricane_Harvey_CSV/Data_Related", "Unrelated"],
    )
    confidence: float = Field(description="Confidence level of the intent detection (0-1).")


def intent_detector(query: str, session_id: str | None = None):
    headers = {
        "Authorization": f"Bearer {kApiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    system_prompt = """
    You are an intent classification system.

    You must classify queries into:
    - HurricaneHarveyGeneral
    - Hurricane_Harvey_CSV/Data_Related
    - Unrelated

    Rules:
    - CSV/Data_Related = Requires structured dataset lookup (buildings, damage, addresses, stats)
    - General = The query is specifically about Hurricane Harvey.
    - Unrelated = Not related to Hurricane Harvey or the dataset, including queries about other hurricanes or hurricanes in general.

    Return ONLY valid JSON.
    """

    csv_context = """
    CSV DATA CONTEXT:
    This dataset contains building-level hurricane damage information.

    Columns:
    - address: building address
    - expected: actual damage severity
    - predicted: model predicted damage severity
    - latitude, longitude: location coordinates
    - match: true if expected = predicted
    """

    history = get_session_history(session_id)
    history_text = "\n".join(
        f"{turn['role']}: {turn['content']}"
        for turn in history[-6:]
        if turn.get("content")
    ) or "No prior conversation."

    print(history_text)

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": f"""
            {csv_context}

            Prior conversation:
            {history_text}

            Return ONLY raw JSON. No markdown. No code fences.

            Schema:
            {IntentDetection.model_json_schema()}

            Query:
            {query}
            """,
        },
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
        "nvext": {"guided_json": IntentDetection.model_json_schema()},
    }

    response = requests.post(invoke_url, headers=headers, json=payload, stream=stream)
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    content = clean_json(content)

    try:
        parsed = IntentDetection.model_validate_json(content)
    except Exception:
        fixed = content.replace("'", '"')
        parsed = IntentDetection.model_validate(json.loads(fixed))

    print(parsed)

    if parsed.intent == "Hurricane_Harvey_CSV/Data_Related" and parsed.confidence >= 0.3:
        response_payload = query_csv_agent_with_history(query, history)
        response_text = response_payload["response"]
        append_session_turn(session_id, "user", query)
        append_session_turn(session_id, "assistant", response_text)
        return response_payload

    if parsed.intent == "HurricaneHarveyGeneral" and parsed.confidence >= 0.3:
        response_text = general_query(query, history)
        append_session_turn(session_id, "user", query)
        append_session_turn(session_id, "assistant", response_text)
        return build_response_payload(response_text, None)

    refusal = "Sorry, I can only answer questions about the disaster assessment dataset or Hurricane Harvey."
    append_session_turn(session_id, "user", query)
    append_session_turn(session_id, "assistant", refusal)
    return build_response_payload(refusal, None)
