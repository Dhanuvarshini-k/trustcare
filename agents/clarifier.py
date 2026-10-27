from __future__ import annotations
import json
import re
from typing import Any
from clinical_utils import normalize_clinical_data

def extract_local_entities(text: str, explicit_data: dict | None = None) -> dict:
    lower = text.lower() if text else ""
    explicit_data = explicit_data or {}

    # 1. Demographics: Age
    age = None
    if explicit_data.get("age") is not None and str(explicit_data.get("age")).strip() != "":
        try:
            val = int(float(explicit_data["age"]))
            if 0 <= val <= 125:
                age = val
        except (ValueError, TypeError):
            pass

    if age is None and text:
        # Regex patterns to parse patient's actual age directly from clinical text
        age_patterns = [
            r'(\d{1,3})\s*-?\s*years?\s*-?\s*old',
            r'(\d{1,3})\s*-?\s*(?:yr|yo|y/o|y\.o\.)(?:-old)?\b',
            r'\bage\s*[:\s=]?\s*(\d{1,3})\b',
            r'\b(\d{1,3})\s*(?:-|–|\s)?(?:years?|yrs?|yo|y/o|y\.o\.)?\s*[-/]?\s*(?:m|f|male|female)\b',
            r'patient\s+is\s+(?:a\s+)?(\d{1,3})',
        ]
        for pat in age_patterns:
            m = re.search(pat, text, re.I)
            if m:
                try:
                    val = int(m.group(1))
                    if 0 <= val <= 125:
                        age = val
                        break
                except (ValueError, TypeError):
                    pass

    # Demographics: Gender / Sex
    gender = None
    if explicit_data.get("sex") is not None and str(explicit_data.get("sex")).strip() != "":
        try:
            s_val = float(explicit_data["sex"])
            gender = "Male" if s_val == 1.0 else "Female" if s_val == 0.0 else None
        except (ValueError, TypeError):
            pass
    elif explicit_data.get("gender"):
        gender = str(explicit_data["gender"]).strip().capitalize()

    if gender is None and text:
        if re.search(r'\b(female|woman|lady)\b', text, re.I):
            gender = "Female"
        elif re.search(r'\b(male|man|gentleman)\b', text, re.I):
            gender = "Male"
        else:
            m_g = re.search(r'\b\d{1,3}\s*(?:-|–|\s)?(?:years?|yrs?|yo|y/o|y\.o\.)?\s*[-/]?\s*([mf])\b', text, re.I)
            if m_g:
                gender = "Male" if m_g.group(1).lower() == 'm' else "Female"

    # 2. Duration
    duration = None
    if explicit_data.get("duration"):
        duration = str(explicit_data["duration"]).strip()

    if not duration and text:
        dur_patterns = [
            r'\b(onset\s+(?:around\s+|approx\s+|about\s+)?\d+\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?)(?:\s*ago)?)\b',
            r'\b(for\s+(?:the\s+)?(?:past\s+|last\s+)?\d+\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?))\b',
            r'\b(over\s+the\s+(?:past\s+|last\s+)?\d+\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?))\b',
            r'\b(\d+\s*(?:-|–|\s)?(?:days?|weeks?|months?|years?)\s*history)\b',
            r'\bduration\s*[:\s=]?\s*(\d+\s*(?:days?|weeks?|months?|years?|hours?|mins?|minutes?))\b',
            r'\b(lasting\s+(?:for\s+)?\d+\s*(?:mins?|minutes?|hours?|days?|weeks?))\b',
            r'\bx\s*(\d+\s*(?:days?|weeks?|months?|years?|hours?))\b',
        ]
        for pat in dur_patterns:
            m_dur = re.search(pat, text, re.I)
            if m_dur:
                duration = m_dur.group(1).strip()
                break

    # 3. Symptoms
    symptom_candidates = [
        ("chest tightness", "chest tightness"),
        ("chest pressure", "chest pressure"),
        ("chest discomfort", "chest discomfort"),
        ("chest pain", "chest pain"),
        ("angina", "angina"),
        ("radiating to (?:the )?(?:left )?arm", "pain radiating to left arm"),
        ("radiating to (?:the )?jaw", "pain radiating to jaw"),
        ("shortness of breath", "shortness of breath"),
        ("dyspnea", "dyspnea"),
        ("difficulty breathing", "difficulty breathing"),
        ("palpitations", "palpitations"),
        ("dizziness", "dizziness"),
        ("lightheadedness", "lightheadedness"),
        ("syncope", "syncope"),
        ("fainting", "fainting"),
        ("diaphoresis", "diaphoresis"),
        ("sweating", "sweating"),
        ("fatigue", "fatigue"),
        ("edema", "edema"),
        ("swelling", "swelling"),
    ]
    extracted_symptoms = []
    for pattern, name in symptom_candidates:
        if re.search(r'\b' + pattern + r'\b', lower):
            if name not in extracted_symptoms:
                extracted_symptoms.append(name)

    # 4. Medical History
    history_candidates = [
        ("hypertension", "hypertension"),
        ("high blood pressure", "hypertension"),
        ("htn", "hypertension"),
        ("hyperlipidaemia", "hyperlipidaemia"),
        ("hyperlipidemia", "hyperlipidemia"),
        ("high cholesterol", "hyperlipidemia"),
        ("dyslipidemia", "dyslipidemia"),
        ("diabetes", "diabetes mellitus"),
        ("t2dm", "type 2 diabetes"),
        ("smoking", "smoking history"),
        ("smoker", "smoking history"),
        ("pack-year", "pack-year smoking history"),
        ("coronary artery disease", "coronary artery disease"),
        ("cad", "coronary artery disease"),
        ("myocardial infarction", "myocardial infarction"),
        ("heart attack", "myocardial infarction"),
        ("stroke", "stroke"),
    ]
    extracted_history = []
    for pattern, name in history_candidates:
        if re.search(r'\b' + pattern + r'\b', lower):
            if name not in extracted_history:
                extracted_history.append(name)

    # 5. Medications
    med_candidates = [
        ("lisinopril", "lisinopril"),
        ("metoprolol", "metoprolol"),
        ("amlodipine", "amlodipine"),
        ("atorvastatin", "atorvastatin"),
        ("aspirin", "aspirin"),
        ("clopidogrel", "clopidogrel"),
        ("nitroglycerin", "nitroglycerin"),
        ("statin", "statin"),
    ]
    extracted_meds = []
    for pattern, name in med_candidates:
        if re.search(r'\b' + pattern + r'\b', lower):
            if name not in extracted_meds:
                extracted_meds.append(name)

    # 6. Labs / Vitals
    labs = []
    if explicit_data.get("trestbps"):
        labs.append(f"Resting BP {explicit_data['trestbps']} mmHg")
    else:
        bp_match = re.search(r'\b(bp\s*[0-9]+/[0-9]+\s*(?:mmhg)?)\b', lower)
        if not bp_match:
            bp_match = re.search(r'\b([0-9]{2,3}/[0-9]{2,3}\s*mmhg)\b', lower)
        if bp_match:
            labs.append(bp_match.group(1).upper())

    if explicit_data.get("chol"):
        labs.append(f"Serum Cholesterol {explicit_data['chol']} mg/dL")

    return {
        "demographics": {"age": age, "gender": gender},
        "symptoms": extracted_symptoms,
        "duration": duration,
        "medical_history": extracted_history,
        "travel_or_exposure_history": None,
        "lab_results": labs,
        "imaging_findings": [],
        "medications": extracted_meds,
        "raw_input": text,
    }

def run(patient_data: Any) -> dict:
    """
    Clarifier agent execution entrypoint.
    Accepts raw narrative string or incoming payload dict with demographics and cardiac parameters.
    """
    raw_text = ""
    explicit_data: dict[str, Any] = {}

    if isinstance(patient_data, str):
        raw_text = patient_data
    elif isinstance(patient_data, dict):
        raw_text = str(
            patient_data.get("raw_text")
            or patient_data.get("rawText")
            or patient_data.get("narrative")
            or patient_data.get("clinical_narrative")
            or patient_data.get("text")
            or ""
        ).strip()
        cp = patient_data.get("cardiac_params") or patient_data.get("cardiacParams") or {}
        if isinstance(cp, dict):
            explicit_data.update(cp)
        for k in ["age", "sex", "gender", "trestbps", "chol", "duration"]:
            if patient_data.get(k) is not None and k not in explicit_data:
                explicit_data[k] = patient_data[k]
    elif hasattr(patient_data, "__dict__"):
        if hasattr(patient_data, "raw_text"):
            raw_text = str(patient_data.raw_text or "").strip()
        if hasattr(patient_data, "cardiac_params") and patient_data.cardiac_params:
            cp = patient_data.cardiac_params
            if hasattr(cp, "model_dump"):
                explicit_data.update(cp.model_dump())
            elif isinstance(cp, dict):
                explicit_data.update(cp)

    extracted = extract_local_entities(raw_text, explicit_data)
    return normalize_clinical_data(extracted, raw_input=raw_text)

def clarify(raw_text: str | dict | Any) -> dict:
    """Backwards-compatible alias for clarifier.run(patient_data)"""
    return run(raw_text)

if __name__ == "__main__":
    test_note = "40-year-old male with chest tightness radiating to the left arm, onset 3 weeks ago. History of hypertension."
    print(json.dumps(run(test_note), indent=2))
