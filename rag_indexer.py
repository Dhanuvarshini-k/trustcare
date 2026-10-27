from Bio import Entrez
import json, os, time
from pathlib import Path
from config import NCBI_EMAIL

Entrez.email = NCBI_EMAIL or "not-configured@example.com"
CONDITIONS = [
    "coronary artery disease", "myocardial infarction", "acute coronary syndrome",
    "heart failure", "atrial fibrillation", "cardiac arrhythmia", "valvular heart disease",
    "cardiomyopathy", "pericarditis", "myocarditis", "hypertension", "cardiogenic shock",
    "cardiac ischemia", "aortic stenosis", "pulmonary hypertension",
]

def search_and_fetch(condition: str, max_results: int = 15):
    query = f'"{condition}"[Title/Abstract] AND (diagnosis[Title/Abstract] OR "clinical features"[Title/Abstract] OR "guideline"[Title/Abstract])'
    with Entrez.esearch(db="pubmed", term=query, retmax=max_results, sort="relevance") as handle:
        ids = Entrez.read(handle)["IdList"]
    if not ids:
        return []
    with Entrez.efetch(db="pubmed", id=ids, rettype="abstract", retmode="xml") as handle:
        records = Entrez.read(handle)
    results = []
    for article in records.get("PubmedArticle", []):
        try:
            citation = article["MedlineCitation"]
            data = citation["Article"]
            title = str(data["ArticleTitle"])
            parts = data.get("Abstract", {}).get("AbstractText", [])
            abstract = " ".join(str(part) for part in parts).strip()
            pmid = str(citation["PMID"])
            if title and abstract:
                results.append({"pmid": pmid, "title": title, "abstract": abstract, "condition": condition})
        except (KeyError, TypeError):
            continue
    return results

if __name__ == "__main__":
    if not NCBI_EMAIL:
        raise SystemExit("Set NCBI_EMAIL in .env before fetching from PubMed.")
    output_path = Path(__file__).resolve().parent / "cardiac_pubmed_abstracts.json"
    existing = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else []
    if not isinstance(existing, list):
        raise ValueError("Existing abstract corpus is not a JSON list.")
    covered = {str(x.get("condition", "")) for x in existing if isinstance(x, dict)}
    by_pmid = {str(x.get("pmid")): x for x in existing if isinstance(x, dict) and x.get("pmid")}
    for condition in CONDITIONS:
        if condition in covered:
            continue
        try:
            print("Fetching:", condition)
            for item in search_and_fetch(condition):
                by_pmid[item["pmid"]] = item
            output_path.write_text(json.dumps(list(by_pmid.values()), indent=2, ensure_ascii=False), encoding="utf-8")
        except Exception as exc:
            print(f"Fetch failed for {condition}: {type(exc).__name__}")
        time.sleep(0.5)
    print(f"Saved {len(by_pmid)} unique PubMed records to {output_path.name}.")
