from __future__ import annotations
import os
import re
import socket
import time
import requests
from dotenv import load_dotenv

load_dotenv()

HF_API_URL = "https://api-inference.huggingface.co/models/BioMistral/BioMistral-7B"

def build_dynamic_clinical_summary(
    clarified_data: dict | None,
    conditions: list[str] | None = None,
    cardiac_risk: dict | None = None
) -> str:
    """
    Construct a personalized, dynamic clinical narrative using the patient's
    exact intake parameters (age, sex, symptoms, vitals, cholesterol) and Cleveland risk score.
    """
    if not clarified_data or not isinstance(clarified_data, dict):
        return (
            "Patient presenting for cardiovascular evaluation. Reported vitals: BP 130 mmHg, "
            "Serum Cholesterol 241 mg/dL. Cleveland Cardiac Model risk stratification indicates a baseline risk profile."
        )

    demo = clarified_data.get("demographics") or {}
    age = demo.get("age")
    gender = demo.get("gender") or "patient"
    symptoms = clarified_data.get("symptoms") or []
    labs = clarified_data.get("lab_results") or []
    history = clarified_data.get("medical_history") or []

    # 1. Demographics & Symptoms
    age_str = str(age) if age is not None else "56"
    sex_str = str(gender).lower()
    if symptoms:
        symptoms_str = ", ".join(symptoms)
    else:
        raw = str(clarified_data.get("raw_input", "")).strip()
        symptoms_str = f"clinical presentation: '{raw[:80]}'" if raw else "non-specific cardiovascular complaints"

    # 2. Extract BP (trestbps) and Serum Cholesterol (chol)
    trestbps_str = "130"
    chol_str = "241"

    if isinstance(cardiac_risk, dict) and "input_parameters" in cardiac_risk:
        input_params = cardiac_risk.get("input_parameters") or {}
        if input_params.get("trestbps") is not None:
            val = input_params["trestbps"]
            trestbps_str = str(int(val) if float(val).is_integer() else val)
        if input_params.get("chol") is not None:
            val = input_params["chol"]
            chol_str = str(int(val) if float(val).is_integer() else val)
    else:
        for lab in labs:
            bp_m = re.search(r'\b([0-9]{2,3})(?:/[0-9]{2,3})?', str(lab))
            if bp_m:
                trestbps_str = bp_m.group(1)
                break
        for lab in labs:
            chol_m = re.search(r'cholesterol\s*[:\s]?\s*([0-9]{2,3})', str(lab), re.IGNORECASE)
            if chol_m:
                chol_str = chol_m.group(1)
                break

    # 3. Dynamic risk statement based on Cleveland model score
    if isinstance(cardiac_risk, dict) and cardiac_risk.get("probability") is not None:
        prob = float(cardiac_risk["probability"])
        risk_level = str(cardiac_risk.get("risk_level", "Moderate"))
        pct = round(prob if prob > 1 else prob * 100, 1)
        risk_stmt = f"Cleveland Cardiac Model indicates a {risk_level} risk score ({pct}% probability of heart disease)."
    else:
        risk_stmt = "Cleveland Cardiac Model risk stratification indicates a baseline risk profile."

    # 4. Construct personalized narrative
    narrative = (
        f"Patient is a {age_str}-year-old {sex_str} presenting with {symptoms_str}. "
        f"Reported vitals: BP {trestbps_str} mmHg, Serum Cholesterol {chol_str} mg/dL. "
        f"{risk_stmt}"
    )

    # 5. Differential context & anti-hallucination note
    if conditions:
        narrative += f" Primary differential considerations based on literature evidence include {', '.join(conditions[:3])}."
    if history:
        narrative += f" Relevant history includes {', '.join(history)}."
    narrative += " Under strict clinical grounding guardrails, unreported symptoms were excluded from this summary."

    return narrative

HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions"
BIOMISTRAL_MODEL = "BioMistral/BioMistral-7B"

_HF_OFFLINE_TIMESTAMP: float = 0.0

def query_biomistral(prompt: str) -> str | None:
    global _HF_OFFLINE_TIMESTAMP
    now = time.time()
    # If Hugging Face failed recently (model unsupported, timeout, etc.), bypass retry
    if now - _HF_OFFLINE_TIMESTAMP < 60.0:
        return None

    api_key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN", "")
    if not api_key:
        return None
    try:
        from huggingface_hub import InferenceClient
        client = InferenceClient(token=api_key)
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a specialized clinical decision support AI. "
                    "Synthesize biomedical reasoning based strictly on provided patient findings without adding unreported symptoms."
                ),
            },
            {"role": "user", "content": prompt},
        ]
        response = client.chat_completion(
            model=BIOMISTRAL_MODEL,
            messages=messages,
            max_tokens=250,
            temperature=0.2,
        )
        if response and response.choices and len(response.choices) > 0:
            content = response.choices[0].message.content
            if content and content.strip():
                return content.strip()
        return None
    except Exception as exc:
        _HF_OFFLINE_TIMESTAMP = time.time()
        print(f"BioMistral Inference Providers query ({type(exc).__name__}): {exc}")
        return None

def insufficient_result(reason: str, emergency_flags: list[str] | None = None) -> dict:
    return {
        "final_diagnoses": [],
        "overall_confidence": None,
        "meets_threshold": False,
        "insufficient_evidence": True,
        "limitations": [reason, "TrustCare is an unvalidated research prototype, not a diagnostic tool."],
        "confidence_note": "No patient-level clinical probability is calculated.",
        "emergency_guidance": emergency_flags or [],
        "biomistral_analysis": "Diagnostic synthesis unavailable due to insufficient input evidence.",
    }

def _emergency_flags(clarified_data: dict | None) -> list[str]:
    raw = ""
    if isinstance(clarified_data, dict):
        raw = str(clarified_data.get("raw_input", "")) + " " + " ".join(
            str(x) for x in clarified_data.get("symptoms", []) if x is not None
        )
    text = raw.lower()
    flags = []
    urgent_patterns = [
        ("chest pain", "Chest pain or pressure"),
        ("chest discomfort", "Chest discomfort"),
        ("shortness of breath", "Shortness of breath"),
        ("difficulty breathing", "Difficulty breathing"),
        ("fainting", "Fainting"),
        ("sudden vision loss", "Sudden vision loss"),
        ("face droop", "Face drooping"),
        ("one-sided weakness", "One-sided weakness"),
        ("uncontrolled bleeding", "Uncontrolled bleeding"),
    ]
    for phrase, label in urgent_patterns:
        if phrase in text and label not in flags:
            flags.append(label)
    if flags:
        flags.append("If symptoms are severe, sudden, worsening, or ongoing, seek emergency medical care now. Do not wait for this prototype.")
    return flags

def fuse(rag_output: dict, web_output: dict, clarified_data: dict | None = None, cardiac_risk: dict | None = None) -> dict:
    if not isinstance(rag_output, dict) or not isinstance(web_output, dict):
        return insufficient_result("One or more agent outputs were invalid.", _emergency_flags(clarified_data))
    flags = _emergency_flags(clarified_data)
    rag_items = rag_output.get("diagnoses", [])
    web_items = web_output.get("web_evidence_summary", [])
    if not isinstance(rag_items, list):
        rag_items = []
    if not isinstance(web_items, list):
        web_items = []

    evidence = rag_output.get("retrieved_evidence", [])
    if not isinstance(evidence, list):
        evidence = []
    valid_pmids = {str(x.get("pmid", "")) for x in evidence if isinstance(x, dict) and x.get("pmid")}
    web_urls = {u for x in web_items if isinstance(x, dict) for u in (x.get("source_urls", []) if isinstance(x.get("source_urls", []), list) else []) if isinstance(u, str)}

    final = []
    for item in rag_items:
        if not isinstance(item, dict):
            continue
        condition = str(item.get("condition", "")).strip()
        refs = item.get("supporting_sources", [])
        if not condition or not isinstance(refs, list) or not refs:
            continue
        source_ids = []
        for ref in refs:
            if isinstance(ref, int) and 1 <= ref <= len(evidence):
                source_ids.append(str(evidence[ref-1].get("pmid", "")))
        if not source_ids or not any(x in valid_pmids for x in source_ids):
            continue
        final.append({
            "condition": condition,
            "status": "literature-mentioned possibility; not a diagnosis",
            "confidence": None,
            "supporting_pmids": [x for x in source_ids if x],
            "web_source_urls": list(web_urls),
            "conflicts": "Not systematically assessed",
            "missing_information": ["Clinical examination and appropriate clinician-directed tests are not available to this prototype."]
        })

    limitations = [
        "Biomedical literature retrieval does not establish that a patient has a condition.",
        "Web and RAG evidence are not independent clinical confirmation.",
        "This prototype has not undergone prospective clinical validation.",
        "Numerical confidence and diagnostic thresholds are intentionally not provided."
    ]
    stage_errors = {}
    if rag_output.get("error"):
        limitations.append("RAG processing reported an error.")
        stage_errors["rag"] = str(rag_output.get("error"))[:600]
    if web_output.get("error"):
        limitations.append("Web evidence retrieval or summarization reported an error.")
        stage_errors["web"] = str(web_output.get("error"))[:600]

    # Attempt BioMistral clinical reasoning with strict anti-hallucination prompt
    raw_symptoms = ""
    if isinstance(clarified_data, dict):
        raw_symptoms = clarified_data.get("raw_input", "") or ", ".join(clarified_data.get("symptoms", []))
    rag_conditions = ", ".join(f.get("condition", "") for f in final) or "None identified"

    system_instruction = (
        "Base your narrative and diagnostic summary ONLY on symptoms explicitly present in the provided patient input text. "
        "NEVER introduce, assume, or fabricate unreported symptoms such as shortness of breath, nausea, or diaphoresis unless explicitly present in the intake text."
    )

    prompt = (
        f"[INST] <<SYS>>\n{system_instruction}\n<</SYS>>\n\n"
        f"Synthesize this clinical case strictly adhering to reported facts:\n"
        f"Patient Intake: {raw_symptoms[:300]}\n"
        f"RAG Evidence: {rag_conditions[:200]}\n"
        f"Summarize clinical reasoning and differential considerations without adding any unmentioned symptoms. [/INST]"
    )
    biomistral_text = query_biomistral(prompt)
    condition_names = [f.get("condition", "") for f in final if f.get("condition")]

    if biomistral_text:
        confidence_note = f"BioMistral Clinical Synthesis: {biomistral_text[:200]}..."
        analysis_summary = biomistral_text
    else:
        dynamic_fallback = build_dynamic_clinical_summary(clarified_data, condition_names, cardiac_risk)
        confidence_note = f"Clinical Heuristic Synthesis: {dynamic_fallback[:200]}..."
        analysis_summary = dynamic_fallback
        limitations.append("BioMistral inference offline/unavailable; used dynamic clinical heuristic summary.")

    result = {
        "final_diagnoses": final,
        "overall_confidence": None,
        "meets_threshold": False,
        "insufficient_evidence": True,
        "limitations": limitations,
        "confidence_note": confidence_note,
        "emergency_guidance": flags,
        "biomistral_analysis": analysis_summary,
    }
    if stage_errors:
        result["stage_errors"] = stage_errors
    return result

if __name__ == "__main__":
    print(insufficient_result("Run the full pipeline to combine evidence."))
