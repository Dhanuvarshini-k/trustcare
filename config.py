from __future__ import annotations
import os
from dotenv import load_dotenv

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "pritamdeka/S-PubMedBert-MS-MARCO")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.getenv("QDRANT_COLLECTION", "cardiac_abstracts")
NCBI_EMAIL = os.getenv("NCBI_EMAIL", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TOP_K = int(os.getenv("RAG_TOP_K", "15"))
MIN_RAG_SCORE = float(os.getenv("RAG_MIN_SCORE", "0.35"))
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN", "")
BIOMEDICAL_MODEL_ID = os.getenv("BIOMEDICAL_MODEL_ID", "BioMistral/BioMistral-7B")

def missing_required(*names: str) -> list[str]:
    values = {
        "GEMINI_API_KEY": GEMINI_API_KEY,
        "TAVILY_API_KEY": TAVILY_API_KEY,
        "NCBI_EMAIL": NCBI_EMAIL,
    }
    return [name for name in names if not values.get(name)]

def require_env(*names: str) -> None:
    missing = missing_required(*names)
    if missing:
        raise RuntimeError(
            "Missing environment variable(s): " + ", ".join(missing) +
            ". Add them to your local .env file; never commit that file."
        )
