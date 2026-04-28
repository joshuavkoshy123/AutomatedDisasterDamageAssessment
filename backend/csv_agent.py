import os
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_experimental.agents import create_csv_agent
from dotenv import load_dotenv

# 🔐 Set your API key (or export it in your terminal)
load_dotenv()

csv_path = "../building_crops/_predictions/final_results.csv"

# ✅ Initialize the Nemotron model (use a text-capable one)
llm = ChatNVIDIA(
    model="nvidia/nemotron-3-super-120b-a12b",   # or another supported Nemotron instruct model
    temperature=0
)

# 📊 Create CSV agent
agent = create_csv_agent(
    llm=llm,
    path=csv_path,   # path to your CSV file
    verbose=True,
    allow_dangerous_code=True,
    agent_type="openai-tools"
)

# 🧠 Ask questions about your CSV
response = agent.invoke({"input": "How many buildings had minor damage on Bering Drive."})
print(response["output"])