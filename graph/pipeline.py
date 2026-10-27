from __future__ import annotations
from agents.clarifier import clarify
from agents.symptom_rag_analyzer import analyze
from agents.evidence_scanner import scan
from agents.clinical_data_fusion import fuse

def run_pipeline(raw_patient_text: str) -> dict:
    if not isinstance(raw_patient_text, str) or not raw_patient_text.strip():
        raise ValueError("Please provide a non-empty fictional or appropriately de-identified case.")
    try:
        clarified = clarify(raw_patient_text)
    except Exception as exc:
        clarified = {"raw_input": raw_patient_text, "symptoms": [], "clarification_error": type(exc).__name__}
    try:
        rag = analyze(clarified)
    except Exception as exc:
        rag = {"diagnoses": [], "retrieved_evidence": [], "insufficient_evidence": True,
               "error": f"RAG stage unavailable ({type(exc).__name__})"}
    candidates = []
    for item in rag.get("diagnoses", []) if isinstance(rag, dict) else []:
        if isinstance(item, dict) and str(item.get("condition", "")).strip():
            candidates.append(str(item["condition"]).strip())
    try:
        web = scan(candidates, clarified) if candidates else {
            "web_evidence_summary": [], "raw_web_results": {}, "insufficient_evidence": True,
            "message": "Skipped because no evidence-supported candidate conditions were returned."
        }
    except Exception as exc:
        web = {"web_evidence_summary": [], "raw_web_results": {}, "insufficient_evidence": True,
               "error": f"Web stage unavailable ({type(exc).__name__})"}
    return fuse(rag, web, clarified)

if __name__ == "__main__":
    import json
    demo = "Fictional case: 58-year-old adult with chest discomfort and shortness of breath. No ECG or laboratory results supplied."
    print(json.dumps(run_pipeline(demo), indent=2))
