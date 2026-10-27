"""
TrustCare CDSS - FastAPI REST API Wrapper
==========================================
Bridges the multi-agent Python backend to the Next.js frontend.

Endpoints
---------
GET  /api/health               - Liveness check (Qdrant + heart model status)
POST /api/clarify              - Clinical Text Clarifier agent only
POST /api/diagnose             - Full pipeline (blocking, returns complete result)
POST /api/diagnose/stream      - Full pipeline as SSE stream (live agent updates)

Run with:
    uvicorn api:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, AsyncGenerator, Optional
from dotenv import load_dotenv

load_dotenv()

import pandas as pd
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

# Ensure the project root is importable
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agents.clarifier import clarify, run as clarifier_run
from agents.clinical_data_fusion import fuse, build_dynamic_clinical_summary
from agents.evidence_scanner import scan
from agents.symptom_rag_analyzer import analyze
from agents.cardiac_model import predict as cardiac_predict, predict_cardiac_risk, _load_heart_model, _CLEVELAND_COLS


# FastAPI App
app = FastAPI(
    title="TrustCare CDSS API",
    description="Multi-Agent Clinical Decision Support System - Research Prototype. NOT a validated clinical tool.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files and root website serving
STATIC_DIR = ROOT / "static"
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

@app.get("/", include_in_schema=False)
async def serve_root():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "TrustCare CDSS API is running", "docs": "/api/docs"}

@app.get("/index.html", include_in_schema=False)
async def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="index.html not found")

@app.get("/style.css", include_in_schema=False)
async def serve_style():
    css_file = STATIC_DIR / "style.css"
    if css_file.exists():
        return FileResponse(str(css_file), media_type="text/css")
    raise HTTPException(status_code=404, detail="style.css not found")

@app.get("/script.js", include_in_schema=False)
async def serve_script():
    js_file = STATIC_DIR / "script.js"
    if js_file.exists():
        return FileResponse(str(js_file), media_type="application/javascript")
    raise HTTPException(status_code=404, detail="script.js not found")


class ClarifyRequest(BaseModel):
    raw_text: str = Field(..., min_length=1)


class CardiacParams(BaseModel):
    age: Optional[float] = None
    sex: Optional[float] = None
    cp: Optional[float] = None
    trestbps: Optional[float] = None
    chol: Optional[float] = None
    fbs: Optional[float] = None
    restecg: Optional[float] = None
    thalach: Optional[float] = None
    exang: Optional[float] = None
    oldpeak: Optional[float] = None
    slope: Optional[float] = None
    ca: Optional[float] = None
    thal: Optional[float] = None


class DiagnoseRequest(BaseModel):
    raw_text: str = Field(default="")
    cardiac_params: Optional[CardiacParams] = None


def _has_patient_input(body: DiagnoseRequest) -> bool:
    if body.raw_text and body.raw_text.strip():
        return True
    if body.cardiac_params:
        cp_dict = body.cardiac_params.model_dump()
        if any(v is not None for v in cp_dict.values()):
            return True
    return False


def _extract_cardiac_dict(body: DiagnoseRequest, clarified: dict) -> tuple[dict, bool]:
    cp_dict = body.cardiac_params.model_dump() if body.cardiac_params else {}
    has_user_cardiac = any(v is not None for v in cp_dict.values())

    demo = clarified.get("demographics") or {}
    if cp_dict.get("age") is None and demo.get("age") is not None:
        try:
            cp_dict["age"] = float(demo["age"])
        except (ValueError, TypeError):
            pass
    if cp_dict.get("sex") is None and demo.get("gender"):
        cp_dict["sex"] = 1.0 if str(demo["gender"]).lower() == "male" else 0.0

    if cp_dict.get("trestbps") is None:
        for lab in clarified.get("lab_results", []):
            m = re.search(r'\b([0-9]{2,3})/[0-9]{2,3}', str(lab))
            if m:
                try:
                    cp_dict["trestbps"] = float(m.group(1))
                    break
                except ValueError:
                    pass
            m2 = re.search(r'\bbp\s*[:\s=]?\s*([0-9]{2,3})\b', str(lab), re.IGNORECASE)
            if m2:
                try:
                    cp_dict["trestbps"] = float(m2.group(1))
                    break
                except ValueError:
                    pass
        if cp_dict.get("trestbps") is None and body.raw_text:
            m = re.search(r'\b([0-9]{2,3})/[0-9]{2,3}\b', body.raw_text)
            if m:
                try:
                    cp_dict["trestbps"] = float(m.group(1))
                except ValueError:
                    pass
            else:
                m2 = re.search(r'\bbp\s*[:\s=]?\s*([0-9]{2,3})\b', body.raw_text, re.IGNORECASE)
                if m2:
                    try:
                        cp_dict["trestbps"] = float(m2.group(1))
                    except ValueError:
                        pass

    if cp_dict.get("chol") is None:
        for lab in clarified.get("lab_results", []):
            m = re.search(r'(?:chol|cholesterol)\s*[:\s=]?\s*([0-9]{2,3})', str(lab), re.IGNORECASE)
            if m:
                try:
                    cp_dict["chol"] = float(m.group(1))
                    break
                except ValueError:
                    pass
        if cp_dict.get("chol") is None and body.raw_text:
            m = re.search(r'(?:chol|cholesterol)\s*[:\s=]?\s*([0-9]{2,3})', body.raw_text, re.IGNORECASE)
            if m:
                try:
                    cp_dict["chol"] = float(m.group(1))
                except ValueError:
                    pass

    if cp_dict.get("cp") is None:
        syms = " ".join(str(s) for s in clarified.get("symptoms", [])).lower()
        if any(w in syms for w in ("angina", "tightness", "pressure")):
            cp_dict["cp"] = 3.0
        elif any(w in syms for w in ("discomfort", "pain")):
            cp_dict["cp"] = 2.0

    has_any_cardiac = any(v is not None for v in cp_dict.values())
    return cp_dict, (has_user_cardiac or has_any_cardiac)


def _ms(t0: float) -> int:
    return int((time.perf_counter() - t0) * 1000)


def _pipeline_sync(body: DiagnoseRequest, explicit_symptoms: list[str] | None = None, patient_data: dict | None = None) -> dict:
    traces: list[dict] = []
    incoming: dict[str, Any] = dict(patient_data) if patient_data else {}
    if not incoming.get("raw_text") and body.raw_text:
        incoming["raw_text"] = body.raw_text
    if body.cardiac_params:
        cp_nested = incoming.setdefault("cardiac_params", {})
        for k, v in body.cardiac_params.model_dump().items():
            if v is not None and k not in cp_nested:
                cp_nested[k] = v

    # Step 1: Clinical Text Clarifier (pass incoming request body directly)
    t0 = time.perf_counter()
    try:
        clarified = clarifier_run(incoming)
        if explicit_symptoms:
            for sym in explicit_symptoms:
                if sym not in clarified["symptoms"]:
                    clarified["symptoms"].append(sym)
        # Sync user-entered cardiac params into demographics if missing
        if body.cardiac_params:
            if clarified.get("demographics", {}).get("age") is None and body.cardiac_params.age is not None:
                clarified.setdefault("demographics", {})["age"] = int(body.cardiac_params.age)
            if clarified.get("demographics", {}).get("gender") is None and body.cardiac_params.sex is not None:
                clarified.setdefault("demographics", {})["gender"] = "Male" if body.cardiac_params.sex == 1 else "Female"
            if body.cardiac_params.trestbps and not clarified.get("lab_results"):
                clarified["lab_results"] = [f"Resting BP {body.cardiac_params.trestbps} mm Hg"]
        traces.append({"agent": "clarifier", "status": "done", "duration_ms": _ms(t0)})
    except Exception as exc:
        clarified = {"raw_input": body.raw_text, "symptoms": list(explicit_symptoms or []), "clarification_error": str(exc)[:300]}
        traces.append({"agent": "clarifier", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})

    # Step 2: Symptom RAG Analyzer
    t0 = time.perf_counter()
    try:
        rag = analyze(clarified)
        traces.append({"agent": "rag_analyzer", "status": "done", "duration_ms": _ms(t0)})
    except Exception as exc:
        rag = {"diagnoses": [], "retrieved_evidence": [], "insufficient_evidence": True, "error": str(exc)[:300]}
        traces.append({"agent": "rag_analyzer", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})

    # Step 3: Evidence Web Scanner
    candidates = [i["condition"] for i in rag.get("diagnoses", []) if isinstance(i, dict) and i.get("condition")]
    t0 = time.perf_counter()
    try:
        web = scan(candidates, clarified) if candidates else {
            "web_evidence_summary": [], "insufficient_evidence": True,
            "message": "No candidate conditions from RAG.",
        }
        traces.append({"agent": "evidence_scanner", "status": "done", "duration_ms": _ms(t0)})
    except Exception as exc:
        web = {"web_evidence_summary": [], "insufficient_evidence": True, "error": str(exc)[:300]}
        traces.append({"agent": "evidence_scanner", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})

    # Step 5 (Precomputed): Cardiac Risk Model
    # Pass incoming request body directly to cardiac_model.predict(patient_data)
    t0 = time.perf_counter()
    try:
        # Cross-populate any parsed demographics into incoming if missing
        if clarified.get("demographics", {}).get("age") is not None and "age" not in incoming:
            incoming["age"] = clarified["demographics"]["age"]
        if clarified.get("demographics", {}).get("gender") is not None and "sex" not in incoming:
            incoming["sex"] = 1.0 if str(clarified["demographics"]["gender"]).lower() == "male" else 0.0

        cardiac_risk = cardiac_predict(incoming)
        cardiac_trace = {"agent": "cardiac_model", "status": "done", "duration_ms": _ms(t0)}
    except Exception as exc:
        cardiac_risk = {"probability": None, "prediction": None, "risk_level": "Unknown", "error": str(exc)[:300], "input_parameters": {}}
        cardiac_trace = {"agent": "cardiac_model", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]}

    # Step 4: Clinical Data Fusion
    t0 = time.perf_counter()
    try:
        fused = fuse(rag, web, clarified, cardiac_risk=cardiac_risk)
        traces.append({"agent": "data_fusion", "status": "done", "duration_ms": _ms(t0)})
    except Exception as exc:
        condition_names = [i["condition"] for i in rag.get("diagnoses", []) if isinstance(i, dict) and i.get("condition")]
        dynamic_fallback = build_dynamic_clinical_summary(clarified, conditions=condition_names, cardiac_risk=cardiac_risk)
        fused = {
            "final_diagnoses": [], "overall_confidence": None, "meets_threshold": False,
            "insufficient_evidence": True, "limitations": [str(exc)[:300]],
            "confidence_note": f"Clinical Heuristic Synthesis: {dynamic_fallback[:200]}...",
            "emergency_guidance": [],
            "biomistral_analysis": "BioMistral LLM API offline/timed out. Applied rule-based clinical heuristic summary: " + dynamic_fallback,
        }
        traces.append({"agent": "data_fusion", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})

    # Step 5: Append cardiac model trace in canonical sequence
    traces.append(cardiac_trace)

    # Step 6: Adaptive Optimizer (proxy: insufficient_evidence flag)
    adaptive_triggered = bool(fused.get("insufficient_evidence", False))
    traces.append({
        "agent": "adaptive_optimizer",
        "status": "triggered" if adaptive_triggered else "skipped",
        "duration_ms": 0,
    })

    return {
        "clarified_data": clarified,
        "rag_output": rag,
        "web_output": web,
        "fused_output": fused,
        "cardiac_risk": cardiac_risk,
        "adaptive_loop_triggered": adaptive_triggered,
        "agent_traces": traces,
    }


async def _stream_pipeline(body: DiagnoseRequest, explicit_symptoms: list[str] | None = None, patient_data: dict | None = None) -> AsyncGenerator[str, None]:
    loop = asyncio.get_event_loop()
    incoming: dict[str, Any] = dict(patient_data) if patient_data else {}
    if not incoming.get("raw_text") and body.raw_text:
        incoming["raw_text"] = body.raw_text
    if body.cardiac_params:
        cp_nested = incoming.setdefault("cardiac_params", {})
        for k, v in body.cardiac_params.model_dump().items():
            if v is not None and k not in cp_nested:
                cp_nested[k] = v

    def sse(data: dict) -> str:
        if "step" in data and "agent" not in data:
            data["agent"] = data["step"]
        elif "agent" in data and "step" not in data:
            data["step"] = data["agent"]
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    async def run(fn):
        return await loop.run_in_executor(None, fn)

    traces: list[dict] = []

    try:
        # Step 1: Clinical Text Clarifier (pass incoming request body directly)
        yield sse({"step": "clarifier", "status": "started"})
        await asyncio.sleep(0.1)
        t0 = time.perf_counter()
        try:
            clarified = await run(lambda: clarifier_run(incoming))
            if explicit_symptoms:
                for sym in explicit_symptoms:
                    if sym not in clarified["symptoms"]:
                        clarified["symptoms"].append(sym)
            if body.cardiac_params:
                if clarified.get("demographics", {}).get("age") is None and body.cardiac_params.age is not None:
                    clarified.setdefault("demographics", {})["age"] = int(body.cardiac_params.age)
                if clarified.get("demographics", {}).get("gender") is None and body.cardiac_params.sex is not None:
                    clarified.setdefault("demographics", {})["gender"] = "Male" if body.cardiac_params.sex == 1 else "Female"
                if body.cardiac_params.trestbps and not clarified.get("lab_results"):
                    clarified["lab_results"] = [f"Resting BP {body.cardiac_params.trestbps} mm Hg"]
            duration = _ms(t0)
            traces.append({"agent": "clarifier", "status": "done", "duration_ms": duration})
            yield sse({"step": "clarifier", "status": "done", "duration_ms": duration})
        except Exception as exc:
            clarified = {"raw_input": body.raw_text, "symptoms": list(explicit_symptoms or []), "clarification_error": str(exc)[:300]}
            traces.append({"agent": "clarifier", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})
            yield sse({"step": "clarifier", "status": "error", "error": str(exc)[:300]})

        await asyncio.sleep(0.1)

        # Step 2: Symptom RAG Analyzer
        yield sse({"step": "rag_analyzer", "status": "started"})
        await asyncio.sleep(0.1)
        t0 = time.perf_counter()
        try:
            rag = await run(lambda: analyze(clarified))
            duration = _ms(t0)
            traces.append({"agent": "rag_analyzer", "status": "done", "duration_ms": duration})
            yield sse({"step": "rag_analyzer", "status": "done", "duration_ms": duration})
        except Exception as exc:
            rag = {"diagnoses": [], "retrieved_evidence": [], "insufficient_evidence": True, "error": str(exc)[:300]}
            traces.append({"agent": "rag_analyzer", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})
            yield sse({"step": "rag_analyzer", "status": "error", "error": str(exc)[:300]})

        await asyncio.sleep(0.1)

        # Step 3: Evidence Web Scanner
        candidates = [i["condition"] for i in rag.get("diagnoses", []) if isinstance(i, dict) and i.get("condition")]
        yield sse({"step": "evidence_scanner", "status": "started"})
        await asyncio.sleep(0.1)
        t0 = time.perf_counter()
        try:
            web = await run(lambda: scan(candidates, clarified)) if candidates else {
                "web_evidence_summary": [], "insufficient_evidence": True, "message": "No candidates."
            }
            duration = _ms(t0)
            traces.append({"agent": "evidence_scanner", "status": "done", "duration_ms": duration})
            yield sse({"step": "evidence_scanner", "status": "done", "duration_ms": duration})
        except Exception as exc:
            web = {"web_evidence_summary": [], "insufficient_evidence": True, "error": str(exc)[:300]}
            traces.append({"agent": "evidence_scanner", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})
            yield sse({"step": "evidence_scanner", "status": "error", "error": str(exc)[:300]})

        await asyncio.sleep(0.1)

        # Step 5 (Precomputed): Cardiac Risk Model
        # Evaluated before fusion so BioMistral / dynamic clinical narrative integrates dynamic risk score
        t0 = time.perf_counter()
        try:
            if clarified.get("demographics", {}).get("age") is not None and "age" not in incoming:
                incoming["age"] = clarified["demographics"]["age"]
            if clarified.get("demographics", {}).get("gender") is not None and "sex" not in incoming:
                incoming["sex"] = 1.0 if str(clarified["demographics"]["gender"]).lower() == "male" else 0.0

            cardiac_risk = await run(lambda: cardiac_predict(incoming))
            cardiac_duration = _ms(t0)
            cardiac_status = "done"
        except Exception as exc:
            cardiac_risk = {"probability": None, "prediction": None, "risk_level": "Unknown", "error": str(exc)[:300], "input_parameters": {}}
            cardiac_duration = _ms(t0)
            cardiac_status = "error"

        # Step 4: Clinical Data Fusion
        yield sse({"step": "data_fusion", "status": "started"})
        await asyncio.sleep(0.1)
        t0 = time.perf_counter()
        try:
            fused = await run(lambda: fuse(rag, web, clarified, cardiac_risk=cardiac_risk))
            duration = _ms(t0)
            traces.append({"agent": "data_fusion", "status": "done", "duration_ms": duration})
            yield sse({"step": "data_fusion", "status": "done", "duration_ms": duration})
        except Exception as exc:
            condition_names = [i["condition"] for i in rag.get("diagnoses", []) if isinstance(i, dict) and i.get("condition")]
            dynamic_fallback = build_dynamic_clinical_summary(clarified, conditions=condition_names, cardiac_risk=cardiac_risk)
            fused = {
                "final_diagnoses": [], "overall_confidence": None, "meets_threshold": False,
                "insufficient_evidence": True, "limitations": [str(exc)[:300]],
                "confidence_note": f"Clinical Heuristic Synthesis: {dynamic_fallback[:200]}...",
                "emergency_guidance": [],
                "biomistral_analysis": "BioMistral LLM API offline/timed out. Applied rule-based clinical heuristic summary: " + dynamic_fallback,
            }
            traces.append({"agent": "data_fusion", "status": "error", "duration_ms": _ms(t0), "error": str(exc)[:300]})
            yield sse({"step": "data_fusion", "status": "error", "error": str(exc)[:300]})

        await asyncio.sleep(0.1)

        # Step 5: Emit Cardiac Model SSE Event
        yield sse({"step": "cardiac_model", "status": "started"})
        await asyncio.sleep(0.1)
        traces.append({"agent": "cardiac_model", "status": cardiac_status, "duration_ms": cardiac_duration})
        yield sse({"step": "cardiac_model", "status": cardiac_status, "duration_ms": cardiac_duration})

        await asyncio.sleep(0.1)

        # Step 6: Adaptive Optimizer
        adaptive_triggered = bool(fused.get("insufficient_evidence", False))
        traces.append({
            "agent": "adaptive_optimizer",
            "status": "triggered" if adaptive_triggered else "skipped",
            "duration_ms": 0,
        })
        yield sse({"step": "adaptive_optimizer", "status": "triggered" if adaptive_triggered else "skipped"})

        await asyncio.sleep(0.1)

        # Complete final event with full payload
        full_payload = {
            "clarified_data": clarified,
            "rag_output": rag,
            "web_output": web,
            "fused_output": fused,
            "cardiac_risk": cardiac_risk,
            "adaptive_loop_triggered": adaptive_triggered,
            "agent_traces": traces,
        }

        yield sse({
            "step": "complete",
            "status": "completed",
            "result": full_payload,
        })
    except Exception as stream_exc:
        yield sse({
            "step": "complete",
            "error": f"Stream processing encountered an error: {str(stream_exc)[:300]}",
        })


@app.get("/api/health", tags=["System"])
async def health_check() -> dict[str, Any]:
    status: dict[str, Any] = {
        "status": "ok",
        "service": "TrustCare CDSS API",
        "version": "1.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "disclaimer": "Research prototype - NOT a validated clinical tool.",
    }
    try:
        from config import COLLECTION_NAME, QDRANT_URL
        from qdrant_client import QdrantClient
        client = QdrantClient(url=QDRANT_URL, timeout=3)
        status["qdrant"] = "connected" if client.collection_exists(COLLECTION_NAME) else "collection_missing"
    except Exception as exc:
        status["qdrant"] = f"unavailable ({type(exc).__name__})"
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _load_heart_model)
        status["heart_model"] = "loaded"
    except Exception as exc:
        status["heart_model"] = f"unavailable ({type(exc).__name__})"
    hf_key = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN")
    status["biomistral"] = "configured" if hf_key else "missing_key"
    return status


@app.post("/api/clarify", tags=["Agents"])
async def clarify_endpoint(request: Request) -> dict:
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = {}
    raw_text = str(raw_payload.get("raw_text") or raw_payload.get("rawText") or "").strip()
    if not raw_text and not raw_payload:
        raise HTTPException(
            status_code=400,
            detail="Missing required patient details! Please enter clinical notes or heart parameters on the dashboard before starting analysis.",
        )
    try:
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: clarifier_run(raw_payload or raw_text))
        return {"status": "ok", "clarified_data": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


def _parse_incoming_payload(raw_payload: dict) -> tuple[DiagnoseRequest, list[str]]:
    raw_text = str(raw_payload.get("raw_text") or raw_payload.get("rawText") or "").strip()
    cp_dict = raw_payload.get("cardiac_params") or raw_payload.get("cardiacParams") or {}
    if not isinstance(cp_dict, dict):
        cp_dict = {}
    else:
        cp_dict = dict(cp_dict)

    # Extract incoming patient fields (age, sex, cp, trestbps, chol, etc.) directly from request.json()
    for k in ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]:
        if k in raw_payload and raw_payload[k] is not None and str(raw_payload[k]).strip() != "" and cp_dict.get(k) is None:
            try:
                cp_dict[k] = float(raw_payload[k])
            except (ValueError, TypeError):
                pass

    explicit_symptoms = raw_payload.get("symptoms") or []
    if isinstance(explicit_symptoms, str):
        explicit_symptoms = [s.strip() for s in explicit_symptoms.split(",") if s.strip()]
    elif not isinstance(explicit_symptoms, list):
        explicit_symptoms = []

    has_input = bool(raw_text) or any(v is not None and v != "" for v in cp_dict.values()) or bool(explicit_symptoms)
    if not has_input:
        raise HTTPException(
            status_code=400,
            detail="Missing required patient details! Please enter clinical notes or heart parameters on the dashboard before starting analysis.",
        )

    cardiac_params = None
    if any(v is not None and v != "" for v in cp_dict.values()):
        cardiac_params = CardiacParams(**{k: float(v) for k, v in cp_dict.items() if k in CardiacParams.model_fields and v is not None and str(v).strip() != ""})

    body = DiagnoseRequest(raw_text=raw_text, cardiac_params=cardiac_params)
    return body, explicit_symptoms


@app.post("/api/diagnose", tags=["Pipeline"])
async def diagnose_endpoint(request: Request) -> dict:
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = {}
    body, explicit_symptoms = _parse_incoming_payload(raw_payload)
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(None, lambda: _pipeline_sync(body, explicit_symptoms=explicit_symptoms, patient_data=raw_payload))
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/api/diagnose/stream", tags=["Pipeline"])
async def diagnose_stream_endpoint(request: Request) -> StreamingResponse:
    try:
        raw_payload = await request.json()
    except Exception:
        raw_payload = {}
    body, explicit_symptoms = _parse_incoming_payload(raw_payload)
    return StreamingResponse(
        _stream_pipeline(body, explicit_symptoms=explicit_symptoms, patient_data=raw_payload),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
