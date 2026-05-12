import os
from pathlib import Path
import re
from typing import Optional
from langchain_nvidia_ai_endpoints import ChatNVIDIA
#from langchain_openrouter import ChatOpenRouter
from langchain_experimental.agents import create_csv_agent
from langchain_experimental.agents import create_pandas_dataframe_agent
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
csv_path = REPO_ROOT / "building_crops" / "_predictions" / "final_results.csv"
df = pd.read_csv(csv_path)

# Initialize the Nemotron model (use a text-capable one)
llm = ChatNVIDIA(
    model="nvidia/nemotron-nano-12b-v2-vl",   # or another supported Nemotron instruct model
    temperature=0
)

# Create CSV agent
# agent = create_csv_agent(
#     llm=llm,
#     path=csv_path,   # path to your CSV file
#     verbose=True,
#     allow_dangerous_code=True,
#     agent_type="tool-calling"
# )

agent = create_pandas_dataframe_agent(
    llm,
    df,
    verbose=True,
    allow_dangerous_code=True,  # required because it writes Python code to query the dataframe
    agent_executor_kwargs={"handle_parsing_errors": True},
    agent_type="zero-shot-react-description",
    prefix = """
You are a Python execution agent.

CRITICAL RULES:
- NEVER use Markdown
- NEVER use ``` or ```py or ```python
- Output ONLY raw Python code
- No explanations inside Action Input

IMPORTANT:
- All questions regarding damage levels should be answered based on the prediction column, unless explcitly stated otherwise.
""",
)

def query_csv_agent(query: str):
    # Ask questions about your CSV
    print("Running CSV Agent")
    print(df['predicted'].value_counts())
    response = agent.invoke({"input": f"{query}"})
    print(response["output"])
    return(response["output"])


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip().lower())


def _extract_coordinates_for_location(location_phrase: str | None) -> Optional[dict]:
    if not location_phrase:
        return None

    location_lower = _normalize_text(location_phrase)
    matches = df[
        df["road"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
        | df["street_address"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
        | df["display_name"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
    ].copy()

    if matches.empty:
        return None

    matches["latitude"] = pd.to_numeric(matches["latitude"], errors="coerce")
    matches["longitude"] = pd.to_numeric(matches["longitude"], errors="coerce")
    matches = matches.dropna(subset=["latitude", "longitude"])
    if matches.empty:
        return None

    row = matches.iloc[0]
    return {
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
    }


def _canonical_damage_label(text: str) -> str | None:
    q = text.lower()
    if (
        "no damage" in q
        or "no-damage" in q
        or "no damages" in q
        or "no-damages" in q
    ):
        return "no-damage"
    if (
        "minor damage" in q
        or "minor-damage" in q
        or "minor damages" in q
        or "minor-damages" in q
    ):
        return "minor-damage"
    if (
        "major damage" in q
        or "major-damage" in q
        or "major damages" in q
        or "major-damages" in q
    ):
        return "major-damage"
    if "destroyed" in q:
        return "destroyed"
    return None


def _target_damage_column(text: str) -> str:
    q = text.lower()
    if "expected" in q or "actual" in q or "ground truth" in q:
        return "expected"
    return "predicted"


def _extract_location_phrase(text: str) -> str | None:
    normalized = text.strip().rstrip("?.!,;:")
    match = re.search(r"\b(?:on|in|at|for)\s+([a-z0-9 ,.'-]+)$", normalized, re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip(" ?.")


def _has_scene_context(text: str) -> bool:
    return bool(re.search(r"hurricane-harvey_\d+|\bscene\b|\bsite\b", text, re.IGNORECASE))


def _has_context_to_inherit(text: str) -> bool:
    return _extract_location_phrase(text) is not None or _has_scene_context(text)


def _resolve_structured_count_query(query: str) -> dict | None:
    q = query.strip()
    q_lower = q.lower()
    if "how many" not in q_lower:
        return None

    damage_label = _canonical_damage_label(q)
    if not damage_label:
        return None

    column = _target_damage_column(q)
    filtered = df[df[column].astype(str).str.lower() == damage_label]

    location_phrase = _extract_location_phrase(q)
    if location_phrase:
        location_lower = location_phrase.lower()
        location_mask = (
            filtered["road"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
            | filtered["street_address"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
            | filtered["city"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
            | filtered["county"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
            | filtered["display_name"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
            | filtered["folder_name"].fillna("").str.lower().str.contains(re.escape(location_lower), regex=True)
        )
        filtered = filtered[location_mask]
        return {
            "response": f"There are {len(filtered)} {damage_label} buildings for {location_phrase}.",
            "coordinates": _extract_coordinates_for_location(location_phrase),
        }

    return {
        "response": f"There are {len(filtered)} {damage_label} buildings.",
        "coordinates": None,
    }


def _last_user_question(history: list[dict] | None) -> str | None:
    if not history:
        return None
    for turn in reversed(history):
        if turn.get("role") == "user" and turn.get("content"):
            return str(turn["content"])
    return None


def _rewrite_followup_query(query: str, history: list[dict] | None = None) -> str:
    current = query.strip()
    if not current:
        return current

    previous_user = _last_user_question(history)
    if not previous_user:
        return current

    q_lower = current.lower()
    prev_lower = previous_user.lower()

    # Preserve the previous aggregation shape when the user only changes damage class.
    damage_terms = {
        "no damage": "no-damage",
        "no-damage": "no-damage",
        "no damages": "no-damage",
        "no-damages": "no-damage",
        "minor damage": "minor-damage",
        "minor-damage": "minor-damage",
        "minor damages": "minor-damage",
        "minor-damages": "minor-damage",
        "major damage": "major-damage",
        "major-damage": "major-damage",
        "major damages": "major-damage",
        "major-damages": "major-damage",
        "destroyed": "destroyed",
    }

    detected_label = None
    for raw, canon in damage_terms.items():
        if raw in q_lower:
            detected_label = canon
            break

    short_followup = len(q_lower.split()) <= 8 or q_lower.startswith(
        ("and ", "what about", "how about", "and what about", "and how about")
    )
    explicit_context_tokens = ["that", "those", "there", "same scene", "previous scene", "that scene", "that street", "that road", "that area"]
    has_explicit_context = any(token in q_lower for token in explicit_context_tokens)
    previous_has_context = _has_context_to_inherit(previous_user)

    if detected_label and short_followup and previous_has_context:
        rewritten = prev_lower
        for raw, canon in damage_terms.items():
            rewritten = rewritten.replace(raw, detected_label)
        if rewritten != prev_lower:
            return rewritten

    if detected_label and short_followup and not previous_has_context and not has_explicit_context:
        return f"How many {detected_label} buildings are there?"

    if detected_label and short_followup and has_explicit_context:
        rewritten = prev_lower
        for raw, canon in damage_terms.items():
            rewritten = rewritten.replace(raw, detected_label)
        if rewritten != prev_lower:
            return rewritten

    if has_explicit_context and short_followup:
        return (
            "Previous user question:\n"
            + previous_user
            + "\n\nCurrent follow-up question:\n"
            + current
            + "\n\nResolve references from the previous user question, but answer only the current follow-up."
        )

    return current


def query_csv_agent_with_history(query: str, history: list[dict] | None = None):
    rewritten_query = _rewrite_followup_query(query, history)
    print(rewritten_query)
    deterministic = _resolve_structured_count_query(rewritten_query)
    print(deterministic)
    if deterministic is not None:
        return deterministic
    return {
        "response": query_csv_agent(rewritten_query),
        "coordinates": _extract_coordinates_for_location(_extract_location_phrase(rewritten_query)),
    }
