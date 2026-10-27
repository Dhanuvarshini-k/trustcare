from __future__ import annotations
import json
import re
from typing import Any

def parse_json_object(text: str) -> dict:
    """Parse a JSON object, tolerating a surrounding Markdown code fence."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("The model returned an empty response.")
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start < 0 or end < start:
        raise ValueError("No JSON object found in model response.")
    obj = json.loads(cleaned[start:end + 1])
    if not isinstance(obj, dict):
        raise ValueError("Expected a JSON object.")
    return obj

def normalize_clinical_data(data: Any, raw_input: str = "") -> dict:
    if not isinstance(data, dict):
        data = {}
    demo = data.get("demographics")
    if not isinstance(demo, dict):
        demo = {}
    list_fields = ("symptoms", "medical_history", "lab_results", "imaging_findings", "medications")
    normalized = {
        "demographics": {"age": demo.get("age"), "gender": demo.get("gender")},
        "symptoms": _string_list(data.get("symptoms")),
        "duration": _optional_string(data.get("duration")),
        "medical_history": _string_list(data.get("medical_history")),
        "travel_or_exposure_history": _optional_string(data.get("travel_or_exposure_history")),
        "lab_results": _string_list(data.get("lab_results")),
        "imaging_findings": _string_list(data.get("imaging_findings")),
        "medications": _string_list(data.get("medications")),
        "raw_input": str(data.get("raw_input") or raw_input or ""),
    }
    age = normalized["demographics"]["age"]
    if isinstance(age, str) and age.strip().isdigit():
        normalized["demographics"]["age"] = int(age.strip())
    elif not isinstance(age, int) or isinstance(age, bool):
        normalized["demographics"]["age"] = None
    for key in ("gender",):
        val = normalized["demographics"][key]
        normalized["demographics"][key] = str(val).strip() if val not in (None, "") else None
    return normalized

def _string_list(value: Any) -> list[str]:
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, (list, tuple)):
        return []
    return [str(x).strip() for x in value if x is not None and str(x).strip()]

def _optional_string(value: Any):
    if value is None or not str(value).strip():
        return None
    return str(value).strip()

CARDIAC_TERMS = {
    "cardiac", "heart", "cardiovascular", "chest pain", "chest discomfort",
    "chest tightness", "chest pressure", "tightness", "pressure",
    "angina", "myocardial", "infarction", "coronary", "arrhythmia",
    "palpitation", "palpitations", "heart failure", "hypertension",
    "troponin", "ecg", "ekg", "ischemia", "ischaemia", "cardiomyopathy",
    "pericarditis", "myocarditis", "aortic", "syncope", "shortness of breath",
    "dyspnea", "dyspnoea", "breathlessness", "edema", "oedema", "arm pain"
}
NON_CARDIAC_REDIRECT_TERMS = {
    "vision loss", "eye pain", "blurry vision", "blurred vision",
    "rash", "toothache", "ear pain", "ankle sprain"
}

def is_cardiac_query(text: str) -> bool:
    lowered = (text or "").lower()
    # Explicit non-cardiac-only presentations should not be mapped to a cardiac corpus.
    if any(term in lowered for term in NON_CARDIAC_REDIRECT_TERMS) and not any(
        term in lowered for term in CARDIAC_TERMS
    ):
        return False
    return any(term in lowered for term in CARDIAC_TERMS)

def safe_error_result(message: str) -> dict:
    return {
        "diagnoses": [],
        "retrieved_evidence": [],
        "insufficient_evidence": True,
        "error": message,
        "limitations": ["Automated output is not a diagnosis and requires clinician review."]
    }
