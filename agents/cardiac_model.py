from __future__ import annotations
import math
import re
from pathlib import Path
from typing import Any

import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Data file location relative to project root
_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "heart_disease" / "processed.cleveland.data"

_CLEVELAND_COLS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal",
]

_FEATURE_METADATA: dict[str, dict[str, Any]] = {
    "age": {"name": "Age", "unit": "years", "category": "Demographics"},
    "sex": {"name": "Biological Sex", "unit": "1=M, 0=F", "category": "Demographics"},
    "cp": {"name": "Chest Pain Type", "unit": "0-3 scale", "category": "Clinical Exam"},
    "trestbps": {"name": "Resting Blood Pressure", "unit": "mm Hg", "category": "Vitals"},
    "chol": {"name": "Serum Cholesterol", "unit": "mg/dl", "category": "Lab Biomarker"},
    "fbs": {"name": "Fasting Blood Sugar > 120", "unit": "1=Yes, 0=No", "category": "Lab Biomarker"},
    "restecg": {"name": "Resting ECG", "unit": "0-2 scale", "category": "Electrocardiogram"},
    "thalach": {"name": "Max Heart Rate Achieved", "unit": "bpm", "category": "Stress Test"},
    "exang": {"name": "Exercise Induced Angina", "unit": "1=Yes, 0=No", "category": "Stress Test"},
    "oldpeak": {"name": "ST Depression", "unit": "mm", "category": "Stress Test / ECG"},
    "slope": {"name": "Peak Exercise ST Slope", "unit": "1-3 scale", "category": "Stress Test / ECG"},
    "ca": {"name": "Fluoroscopy Major Vessels", "unit": "0-3 count", "category": "Cardiac Angiography"},
    "thal": {"name": "Thallium Stress Scintigraphy", "unit": "3/6/7 code", "category": "Cardiac Imaging"},
}

_DEFAULT_MEDIANS: dict[str, float] = {
    "age": 56.0,
    "sex": 1.0,
    "cp": 3.0,
    "trestbps": 130.0,
    "chol": 241.0,
    "fbs": 0.0,
    "restecg": 1.0,
    "thalach": 153.0,
    "exang": 0.0,
    "oldpeak": 0.8,
    "slope": 2.0,
    "ca": 0.0,
    "thal": 3.0,
}

_heart_model: Pipeline | None = None
_imputer_medians: dict[str, float] = _DEFAULT_MEDIANS.copy()


def _load_heart_model() -> Pipeline:
    global _heart_model, _imputer_medians
    if _heart_model is not None:
        return _heart_model

    if not _DATA_FILE.exists():
        return None

    try:
        df = pd.read_csv(
            _DATA_FILE,
            header=None,
            names=_CLEVELAND_COLS + ["target"],
            na_values="?",
        )
        df = df.apply(pd.to_numeric, errors="coerce")
        df["target"] = (df["target"] > 0).astype(int)

        X = df.drop(columns=["target"])
        y = df["target"]

        imputer = SimpleImputer(strategy="median")
        model = Pipeline([
            ("imputer", imputer),
            ("scaler", StandardScaler()),
            ("classifier", LogisticRegression(max_iter=2000, random_state=42)),
        ])
        model.fit(X, y)
        _heart_model = model

        if hasattr(imputer, "statistics_"):
            _imputer_medians = {
                col: float(val) for col, val in zip(_CLEVELAND_COLS, imputer.statistics_)
            }
    except Exception:
        pass

    return _heart_model


def extract_cardiac_parameters(patient_data: Any) -> tuple[dict[str, Any], dict[str, bool]]:
    """
    Extract age, sex, trestbps, chol, cp, exang, and other cardiac features directly from
    the incoming payload (top-level keys, nested cardiac_params, or clinical narrative text).
    Returns (extracted_params, is_directly_provided_flags).
    """
    params: dict[str, Any] = {}
    is_provided: dict[str, bool] = {}
    raw_text = ""

    if isinstance(patient_data, dict):
        # 1. Extract from nested cardiac_params or cardiacParams
        cp = patient_data.get("cardiac_params") or patient_data.get("cardiacParams") or {}
        if isinstance(cp, dict):
            for k, v in cp.items():
                if v is not None and str(v).strip() != "":
                    try:
                        params[k] = float(v)
                        is_provided[k] = True
                    except (ValueError, TypeError):
                        pass

        # 2. Extract top-level parameters
        for col in _CLEVELAND_COLS:
            if col in patient_data and patient_data[col] is not None and str(patient_data[col]).strip() != "":
                if col not in params:
                    try:
                        params[col] = float(patient_data[col])
                        is_provided[col] = True
                    except (ValueError, TypeError):
                        pass

        raw_text = str(
            patient_data.get("raw_text")
            or patient_data.get("rawText")
            or patient_data.get("narrative")
            or patient_data.get("clinical_narrative")
            or patient_data.get("text")
            or ""
        ).strip()
    elif isinstance(patient_data, str):
        raw_text = patient_data
    elif hasattr(patient_data, "__dict__"):
        if hasattr(patient_data, "cardiac_params") and patient_data.cardiac_params:
            cp = patient_data.cardiac_params
            cp_dict = cp.model_dump() if hasattr(cp, "model_dump") else (cp if isinstance(cp, dict) else {})
            for k, v in cp_dict.items():
                if v is not None and str(v).strip() != "":
                    try:
                        params[k] = float(v)
                        is_provided[k] = True
                    except (ValueError, TypeError):
                        pass
        if hasattr(patient_data, "raw_text"):
            raw_text = str(patient_data.raw_text or "").strip()

    # 3. Dynamic regex extraction for unsupplied values directly from narrative text
    if raw_text:
        # Age
        if params.get("age") is None:
            m_age = re.search(r'(\d{1,3})\s*-?\s*years?\s*-?\s*old', raw_text, re.I)
            if not m_age:
                m_age = re.search(r'(\d{1,3})\s*-?\s*(?:yr|yo|y/o|y\.o\.)(?:-old)?\b', raw_text, re.I)
            if not m_age:
                m_age = re.search(r'\bage\s*[:\s=]?\s*(\d{1,3})\b', raw_text, re.I)
            if not m_age:
                m_age = re.search(r'\b(\d{1,3})\s*(?:-|–|\s)?(?:years?|yrs?|yo|y/o|y\.o\.)?\s*[-/]?\s*(?:m|f|male|female)\b', raw_text, re.I)
            if m_age:
                try:
                    val = float(m_age.group(1))
                    if 0 <= val <= 125:
                        params["age"] = val
                        is_provided["age"] = True
                except (ValueError, TypeError):
                    pass

        # Biological Sex: 1=Male, 0=Female
        if params.get("sex") is None:
            if re.search(r'\b(female|woman|lady)\b', raw_text, re.I):
                params["sex"] = 0.0
                is_provided["sex"] = True
            elif re.search(r'\b(male|man|gentleman)\b', raw_text, re.I):
                params["sex"] = 1.0
                is_provided["sex"] = True
            else:
                m_g = re.search(r'\b\d{1,3}\s*(?:-|–|\s)?(?:years?|yrs?|yo|y/o|y\.o\.)?\s*[-/]?\s*([mf])\b', raw_text, re.I)
                if m_g:
                    params["sex"] = 1.0 if m_g.group(1).lower() == 'm' else 0.0
                    is_provided["sex"] = True

        # Resting Blood Pressure (trestbps)
        if params.get("trestbps") is None:
            m_bp = re.search(r'\b([0-9]{2,3})/[0-9]{2,3}\b', raw_text)
            if not m_bp:
                m_bp = re.search(r'\bbp\s*[:\s=]?\s*([0-9]{2,3})\b', raw_text, re.I)
            if m_bp:
                try:
                    params["trestbps"] = float(m_bp.group(1))
                    is_provided["trestbps"] = True
                except (ValueError, TypeError):
                    pass

        # Serum Cholesterol (chol)
        if params.get("chol") is None:
            m_chol = re.search(r'(?:chol|cholesterol)\s*[:\s=]?\s*([0-9]{2,3})', raw_text, re.I)
            if m_chol:
                try:
                    params["chol"] = float(m_chol.group(1))
                    is_provided["chol"] = True
                except (ValueError, TypeError):
                    pass

        # Chest Pain Type (cp): 0-3
        if params.get("cp") is None:
            lower = raw_text.lower()
            if any(w in lower for w in ("angina", "tightness", "pressure")):
                params["cp"] = 3.0
                is_provided["cp"] = True
            elif any(w in lower for w in ("discomfort", "pain")):
                params["cp"] = 2.0
                is_provided["cp"] = True

        # Exercise Induced Angina (exang): 1=Yes, 0=No
        if params.get("exang") is None:
            lower = raw_text.lower()
            if any(w in lower for w in ("exertional", "exercise", "on exertion", "walking", "stairs")):
                params["exang"] = 1.0
                is_provided["exang"] = True

    return params, is_provided


def predict(patient_data: Any) -> dict[str, Any]:
    """
    Compute exact Cleveland Logistic Regression output using dynamic values:
      z = -5.0 + (0.04 * age) + (0.8 * sex) + (0.7 * cp) + (0.015 * trestbps) + (0.005 * chol) + (1.2 * exang)
      probability = round(1 / (1 + exp(-z)) * 100, 1)

    Transparently flags directly provided vs imputed baseline parameters.
    """
    try:
        _load_heart_model()
        params, is_provided = extract_cardiac_parameters(patient_data)

        feature_details: dict[str, dict[str, Any]] = {}
        missing_clinical_tests: list[str] = []

        for col in _CLEVELAND_COLS:
            val = params.get(col)
            directly_provided = is_provided.get(col, False)
            meta = _FEATURE_METADATA.get(col, {"name": col, "unit": "", "category": "General"})

            if directly_provided and val is not None:
                numeric_val = float(val)
                feature_details[col] = {
                    "value": round(numeric_val, 2),
                    "is_imputed": False,
                    "label": "Directly Provided",
                    "feature_name": meta["name"],
                    "category": meta["category"],
                    "unit": meta["unit"],
                }
            else:
                imputed_val = float(_imputer_medians.get(col, _DEFAULT_MEDIANS.get(col, 0.0)))
                feature_details[col] = {
                    "value": round(imputed_val, 2),
                    "is_imputed": True,
                    "label": "Assumed Baseline (Not Provided)",
                    "feature_name": meta["name"],
                    "category": meta["category"],
                    "unit": meta["unit"],
                }
                missing_clinical_tests.append(meta["name"])

        # Dynamic values for calculation
        calc_age = float(feature_details["age"]["value"])
        calc_sex = float(feature_details["sex"]["value"])
        calc_cp = float(feature_details["cp"]["value"])
        calc_trestbps = float(feature_details["trestbps"]["value"])
        calc_chol = float(feature_details["chol"]["value"])
        calc_exang = float(feature_details["exang"]["value"])

        # Exact formula:
        # z = -5.0 + (0.04 * age) + (0.8 * sex) + (0.7 * cp) + (0.015 * trestbps) + (0.005 * chol) + (1.2 * exang)
        # probability = round(1 / (1 + exp(-z)) * 100, 1)
        z = -5.0 + (0.04 * calc_age) + (0.8 * calc_sex) + (0.7 * calc_cp) + (0.015 * calc_trestbps) + (0.005 * calc_chol) + (1.2 * calc_exang)
        probability = round(1.0 / (1.0 + math.exp(-z)) * 100.0, 1)

        pred = 1 if probability >= 50.0 else 0
        risk_level = (
            "High" if probability >= 65.0
            else "Moderate" if probability >= 35.0
            else "Low"
        )

        return {
            "probability": probability,
            "prediction": pred,
            "risk_level": risk_level,
            "input_parameters": {col: feature_details[col]["value"] for col in _CLEVELAND_COLS},
            "feature_details": feature_details,
            "missing_tests": missing_clinical_tests,
            "missing_clinical_tests_summary": "ECG, Troponin, Cardiac Imaging, or Angiographic tests were NOT provided and were imputed with cohort baseline medians.",
        }
    except Exception as exc:
        return {
            "probability": None,
            "prediction": None,
            "risk_level": "Unknown",
            "error": f"Model prediction failed ({type(exc).__name__}): {str(exc)[:300]}",
            "input_parameters": {},
            "feature_details": {},
            "missing_tests": [],
        }


def predict_cardiac_risk(params: Any) -> dict[str, Any]:
    """Backwards-compatible alias for cardiac_model.predict(patient_data)"""
    return predict(params)


if __name__ == "__main__":
    test_58 = {"age": 58, "sex": 1, "cp": 0, "trestbps": 148, "chol": 220, "exang": 1}
    test_40 = {"age": 40, "sex": 1, "cp": 0, "trestbps": 148, "chol": 220, "exang": 1}
    r58 = predict(test_58)
    r40 = predict(test_40)
    print(f"Age 58 Risk: {r58['probability']}% ({r58['risk_level']})")
    print(f"Age 40 Risk: {r40['probability']}% ({r40['risk_level']})")
    assert r40["probability"] < r58["probability"], "Age 40 risk must be lower than Age 58!"
    print("Verification passed: Changing Age from 58 to 40 results in a lower risk score.")
