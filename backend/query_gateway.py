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
CSV_INTENT = "Hurricane_Harvey_CSV/Data_Related"
GENERAL_INTENT = "HurricaneHarveyGeneral"
UNRELATED_INTENT = "Unrelated"


def clean_json(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(json)?", "", text)
    text = re.sub(r"```$", "", text)
    return text.strip()


def get_session_history(session_id: str | None) -> list[dict]:
    if not session_id:
        return []
    return list(conversation_store[session_id])


def append_session_turn(session_id: str | None, role: str, content: str, intent: str | None = None) -> None:
    if not session_id or not content:
        return
    turn = {"role": role, "content": content}
    if intent:
        turn["intent"] = intent
    conversation_store[session_id].append(turn)


def filter_history_by_intent(history: list[dict], intent: str) -> list[dict]:
    return [turn for turn in history if turn.get("intent") == intent]


def get_last_session_intent(history: list[dict]) -> str | None:
    for turn in reversed(history):
        intent = turn.get("intent")
        if intent:
            return str(intent)
    return None


def is_short_followup(query: str) -> bool:
    q = query.strip().lower()
    return len(q.split()) <= 10 or q.startswith(
        ("and ", "what about", "how about", "and what about", "and how about")
    )


def looks_like_csv_query(query: str) -> bool:
    q = query.lower()
    csv_markers = [
        "how many",
        "count",
        "counts",
        "accuracy",
        "match",
        "matched",
        "predicted",
        "expected",
        "ground truth",
        "building",
        "buildings",
        "address",
        "street",
        "road",
        "boulevard",
        "blvd",
        "scene",
        "site",
        "uid",
        "no-damage",
        "no damage",
        "minor-damage",
        "minor damage",
        "major-damage",
        "major damage",
        "destroyed",
    ]
    return any(marker in q for marker in csv_markers)


def looks_like_general_harvey_query(query: str) -> bool:
    q = query.lower()
    general_markers = [
        "hurricane harvey",
        "harvey",
        "recovery",
        "response",
        "flooding",
        "flood",
        "rainfall",
        "storm surge",
        "houston",
        "why was",
        "what caused",
        "what happened",
        "impact",
        "evacuation",
        "aid",
        "relief",
        "rebuilding",
    ]
    return any(marker in q for marker in general_markers)


def looks_like_unrelated_query(query: str) -> bool:
    q = query.lower()
    unrelated_markers = [
        "super bowl",
        "nba",
        "nfl",
        "mlb",
        "nhl",
        "soccer",
        "capital of",
        "france",
        "president of",
        "prime minister",
        "movie",
        "movies",
        "theater",
        "theatre",
        "recipe",
        "cook",
        "bake",
        "restaurant",
        "stock price",
        "bitcoin",
        "weather in",
    ]
    return any(marker in q for marker in unrelated_markers)


def route_by_rules(query: str, history: list[dict]) -> str | None:
    q = query.strip().lower()
    csv_like = looks_like_csv_query(q)
    general_like = looks_like_general_harvey_query(q)
    unrelated_like = looks_like_unrelated_query(q)
    last_intent = get_last_session_intent(history)

    if csv_like and not general_like:
        return CSV_INTENT
    if general_like and not csv_like:
        return GENERAL_INTENT
    if unrelated_like and not csv_like and not general_like:
        return UNRELATED_INTENT

    if is_short_followup(q) and last_intent in {CSV_INTENT, GENERAL_INTENT}:
        if any(token in q for token in ["that street", "that road", "that scene", "that area", "there"]):
            return last_intent
        if csv_like:
            return CSV_INTENT
        return last_intent

    return None


def build_response_payload(response: str, coordinates: dict | None = None) -> dict:
    return {
        "response": response,
        "coordinates": coordinates,
    }


class IntentDetection(BaseModel):
    intent: str = Field(
        description="The identified intent of the user query. Default to 'Unrelated' if no suitable enum is found.",
        enum=[GENERAL_INTENT, CSV_INTENT, UNRELATED_INTENT],
    )
    confidence: float = Field(description="Confidence level of the intent detection (0-1).")


def intent_detector(query: str, session_id: str | None = None):
    history = get_session_history(session_id)
    routed_intent = route_by_rules(query, history)

    if routed_intent == CSV_INTENT:
        csv_history = filter_history_by_intent(history, CSV_INTENT)
        response_payload = query_csv_agent_with_history(query, csv_history)
        response_text = response_payload["response"]
        append_session_turn(session_id, "user", query, CSV_INTENT)
        append_session_turn(session_id, "assistant", response_text, CSV_INTENT)
        return response_payload

    if routed_intent == GENERAL_INTENT:
        general_history = filter_history_by_intent(history, GENERAL_INTENT)
        response_text = general_query(query, general_history)
        append_session_turn(session_id, "user", query, GENERAL_INTENT)
        append_session_turn(session_id, "assistant", response_text, GENERAL_INTENT)
        return build_response_payload(response_text, None)

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

    if parsed.intent == CSV_INTENT and parsed.confidence >= 0.3:
        csv_history = filter_history_by_intent(history, CSV_INTENT)
        response_payload = query_csv_agent_with_history(query, csv_history)
        response_text = response_payload["response"]
        append_session_turn(session_id, "user", query, CSV_INTENT)
        append_session_turn(session_id, "assistant", response_text, CSV_INTENT)
        return response_payload

    if parsed.intent == GENERAL_INTENT and parsed.confidence >= 0.3:
        general_history = filter_history_by_intent(history, GENERAL_INTENT)
        response_text = general_query(query, general_history)
        append_session_turn(session_id, "user", query, GENERAL_INTENT)
        append_session_turn(session_id, "assistant", response_text, GENERAL_INTENT)
        return build_response_payload(response_text, None)

    refusal = "Sorry, I can only answer questions about the disaster assessment dataset or Hurricane Harvey."
    append_session_turn(session_id, "user", query, UNRELATED_INTENT)
    append_session_turn(session_id, "assistant", refusal, UNRELATED_INTENT)
    return build_response_payload(refusal, None)
