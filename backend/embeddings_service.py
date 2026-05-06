from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
import os
from dotenv import load_dotenv
from langchain_community.vectorstores import PGVector

load_dotenv()

embeddings = NVIDIAEmbeddings(model="nvidia/nv-embedcode-7b-v1")

vector_store = PGVector(
    connection_string=os.getenv("DATABASE_URL"),
    embedding_function=embeddings,
    collection_name="docs",
    pre_delete_collection=False
)

file_path = "./Harvey1.pdf"
loader = PyPDFLoader(
    file_path,
    mode="single",
    pages_delimiter="\n-------THIS IS A CUSTOM END OF PAGE-------\n",
)
docs = loader.load()
print(len(docs))
print(docs[0].page_content[:5780])

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,  # chunk size (characters)
    chunk_overlap=200,  # chunk overlap (characters)
    add_start_index=True,  # track index in original document
)
all_splits = text_splitter.split_documents(docs)

print(f"Split blog post into {len(all_splits)} sub-documents.")

document_ids = vector_store.add_documents(documents=all_splits)

print(document_ids[:3])