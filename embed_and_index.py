from __future__ import annotations
import json
from pathlib import Path
from sentence_transformers import SentenceTransformer
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct
from config import EMBEDDING_MODEL, QDRANT_URL, COLLECTION_NAME

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "cardiac_pubmed_abstracts.json"

def main():
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Abstract corpus not found: {DATA_FILE}")
    abstracts = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    if not isinstance(abstracts, list):
        raise ValueError("The abstract corpus must be a JSON list.")
    model = SentenceTransformer(EMBEDDING_MODEL)
    dim = model.get_sentence_embedding_dimension()
    client = QdrantClient(url=QDRANT_URL, timeout=15)
    if client.collection_exists(COLLECTION_NAME):
        info = client.get_collection(COLLECTION_NAME)
        existing = info.config.params.vectors
        existing_dim = getattr(existing, "size", None)
        if existing_dim and existing_dim != dim:
            raise RuntimeError(
                f"Collection dimension ({existing_dim}) does not match model ({dim}). "
                "Back up the collection before recreating it; this script will not delete data."
            )
    else:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE)
        )
    points = []
    for item in abstracts:
        if not isinstance(item, dict):
            continue
        pmid = str(item.get("pmid", "")).strip()
        title = str(item.get("title", "")).strip()
        abstract = str(item.get("abstract", "")).strip()
        if not pmid.isdigit() or not title or not abstract:
            continue
        vector = model.encode(f"{title}. {abstract}", normalize_embeddings=True).tolist()
        points.append(PointStruct(
            id=int(pmid), vector=vector,
            payload={"title": title, "abstract": abstract,
                     "condition": str(item.get("condition", "")), "pmid": pmid,
                     "source": "PubMed", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                     "embedding_model": EMBEDDING_MODEL}
        ))
    if not points:
        raise RuntimeError("No valid abstract records were available to index.")
    for start in range(0, len(points), 64):
        client.upsert(collection_name=COLLECTION_NAME, points=points[start:start+64], wait=True)
    print(f"Indexed/upserted {len(points)} valid abstracts into '{COLLECTION_NAME}' using {EMBEDDING_MODEL} ({dim} dimensions).")

if __name__ == "__main__":
    main()
