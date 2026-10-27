# TrustCare revised prototype files

## What changed
- Normalizes/validates the clinical extraction schema.
- Keeps the cardiac-only retrieval corpus from being used for obviously unrelated inputs.
- Filters retrieval candidates with similarity and lexical overlap heuristics; these are not medical confidence scores.
- Preserves PubMed IDs/URLs and validates that LLM source references point to retrieved records.
- Uses patient context when constructing web queries and keeps source URLs/tier metadata.
- Defaults web evidence strength to `not_assessed`; a domain label is not proof of claim accuracy.
- Makes fusion deterministic and conservative; no numerical diagnosis confidence or threshold claims.
- Adds broad failure fallbacks and basic safety/regression tests.
- Surfaces concise RAG/web stage diagnostics in pipeline output instead of hiding the underlying error behind a generic limitation.
- Distinguishes embedding-model failures from Qdrant connectivity and missing-collection errors.
- Uses the embedding model's actual dimension and refuses to silently delete/recreate a mismatched Qdrant collection.

## Important
This is a research prototype, not a medical device or validated clinical decision support tool. Retrieval heuristics and tests do not prove clinical safety or accuracy. Do not enter identifiable patient information. Emergency symptoms require immediate professional assessment; never wait for this software.

## Setup
1. Back up your current project.
2. Copy these files over the matching source files.
3. Create a local `.env` from `.env.example` and set credentials.
4. Install dependencies: `python -m pip install -r requirements.txt`
5. Ensure Qdrant is running and the existing `cardiac_pubmed_abstracts.json` is in the project root.
6. Run tests: `python -m unittest discover -s tests -v`
7. Run demo: `python pipeline_demo.py`. If RAG setup fails, inspect the `stage_errors.rag` field in the JSON output; it will identify the next fix without printing credentials or patient prompts.

If Qdrant's collection dimension is inconsistent, back up the collection/data before manually rebuilding it. This script intentionally does not delete collections.
