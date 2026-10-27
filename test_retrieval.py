"""Manual smoke test for the configured Qdrant index; does not diagnose."""
from agents.symptom_rag_analyzer import analyze

if __name__ == "__main__":
    cases = [
        {"symptoms": ["chest discomfort", "shortness of breath"]},
        {"symptoms": ["sudden painless left eye vision loss"]},
    ]
    for case in cases:
        print("\nINPUT:", case)
        result = analyze(case)
        print("Retrieved evidence:", len(result.get("retrieved_evidence", [])))
        print("Insufficient evidence:", result.get("insufficient_evidence"))
        print("Message:", result.get("message", result.get("error", "")))
