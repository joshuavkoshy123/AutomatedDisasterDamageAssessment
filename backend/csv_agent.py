import os
from langchain_nvidia_ai_endpoints import ChatNVIDIA
#from langchain_openrouter import ChatOpenRouter
from langchain_experimental.agents import create_csv_agent
from langchain_experimental.agents import create_pandas_dataframe_agent
from dotenv import load_dotenv
import pandas as pd
from pathlib import Path

load_dotenv()

#csv_path = Path.cwd() / "building_crops" / "_predictions" / "final_results.csv"
csv_path = "../building_crops/_predictions/final_results.csv"
df = pd.read_csv(csv_path)

# remove expected column from df
df = df.drop(columns=["expected"])

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