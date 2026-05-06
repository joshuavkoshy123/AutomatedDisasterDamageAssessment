import json
import requests
import os
import base64
import sys
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field
from dotenv import load_dotenv
# from backend.csv_agent import query_csv_agent
# from backend.general_query import general_chat
from csv_agent import query_csv_agent
#from general_query import general_chat
from RAG import general_query
import re

load_dotenv()

invoke_url = "https://integrate.api.nvidia.com/v1/chat/completions"
stream = False
query = "Tell me about Hurricane Harvey"

kApiKey = os.getenv("NVIDIA_API_KEY")

def clean_json(text: str) -> str:
    text = text.strip()

    # remove ```json or ``` fences
    text = re.sub(r"^```(json)?", "", text)
    text = re.sub(r"```$", "", text)

    return text.strip()

class IntentDetection(BaseModel):
    intent: str = Field(description="The identified intent of the user query. Default to 'Unrelated' if you don't find a suitable enum for it.", enum=["HurricaneHarveyGeneral", "Hurricane_Harvey_CSV/Data_Related", "Unrelated"])
    confidence: float = Field(description="Confidence level of the intent detection (0-1).")

def intent_detector(query: str):
    
    infer_url = invoke_url

    #content = "Extract the desired information from the following query." + "\n\n" + "Only extract the properties mentioned in the 'IntentDetection' function." + "\n\n" + f"Query: {query}"
    
    headers = {
        "Authorization": f"Bearer {kApiKey}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Add system message with appropriate prompt
    # Videos only support /no_think, images support both
    
    system_prompt = """
    You are an intent classification system.

    You must classify queries into:
    - HurricaneHarveyGeneral
    - Hurricane_Harvey_CSV/Data_Related
    - Unrelated

    Rules:
    - CSV/Data_Related = Requires structured dataset lookup (buildings, damage, addresses, stats)
    - General = The query is specifically about Hurricane Harvey.
    - Unrelated = Not related to hurricane harvey or the dataset, including queries about other hurricanes or hurricanes in general.

    Return ONLY valid JSON.
    """

    csv_context = """
    CSV DATA CONTEXT:
    This dataset contains building-level hurricane damage information.

    Columns:
    - address: building address
    - expected: actual damage severity
    - predicted: models predicted damage severity
    - latitude, longitude: location coordinates
    - match: true if expected = predicted
    """
    
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        {
            "role": "user",
            "content": f"""
            {csv_context}

            Return ONLY raw JSON. No markdown. No code fences.

            Schema:
            {IntentDetection.model_json_schema()}

            Query:
            {query}
            """
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
        "nvext": {
            "guided_json": IntentDetection.model_json_schema()
        }
    }

    response = requests.post(infer_url, headers=headers, json=payload, stream=stream)
    
    data = response.json()

    content = data['choices'][0]['message']['content']

    # make sure response is in proper json format
    content = clean_json(content)

    parsed = None

    try:
        parsed = IntentDetection.model_validate_json(content)
        print(parsed.intent, parsed.confidence)
    except Exception:
        fixed = content.replace("'", '"')
        parsed = IntentDetection.model_validate(json.loads(fixed))
        print("Fixed clanker syntax")

    if (parsed.intent == "Hurricane_Harvey_CSV/Data_Related" and parsed.confidence >= 0.3):
        return query_csv_agent(query)
    if (parsed.intent == "HurricaneHarveyGeneral" and parsed.confidence >= 0.3):
        return general_query(query)
    return "Sorry, I can't answer any unrelated queries. Please try again with a query related to Hurricane Harvey or the map."

# Generate prompt
# prompt = ChatPromptTemplate.from_template(
# """
# Extract the desired information from the following query.

# Only extract the properties mentioned in the 'IntentDetection' function.

# Query:
# {input}
# """
# )

# Query the model to determine intent
# q = "How many buildings had predicted no-damage?"
# p = prompt.invoke({"input": q})
# response = llm.invoke(p)
# print(response)