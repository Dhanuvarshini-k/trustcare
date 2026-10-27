"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Send, RotateCcw } from "lucide-react";
import { useCDSSStore } from "@/lib/store";
import CardiacParametersPanel from "./CardiacParametersPanel";
import type { CardiacParams, PatientFormData } from "@/lib/types";

const EXAMPLE_NOTE = `Fictional test case: 58-year-old male presenting with exertional chest tightness radiating to the left arm, onset 3 weeks ago. History of hypertension (on lisinopril), hyperlipidaemia, and a 20 pack-year smoking history (quit 5 years ago). Resting BP 148/92 mmHg. No ECG, troponin, or imaging results provided.`;

const EMPTY_CARDIAC: CardiacParams = {
  age: null, sex: null, cp: null, trestbps: null, chol: null,
  fbs: null, restecg: null, thalach: null, exang: null,
  oldpeak: null, slope: null, ca: null, thal: null,
};

export default function PatientForm() {
  const router = useRouter();
  const { setFormData, resetPipeline } = useCDSSStore();

  const [rawText, setRawText] = useState("");
  const [cardiacParams, setCardiacParams] = useState<CardiacParams>({ ...EMPTY_CARDIAC });
  const [includeCardiac, setIncludeCardiac] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasCardiacValues =
      includeCardiac &&
      Object.values(cardiacParams).some((v) => v !== null && v !== undefined && v !== "");
    if (!rawText.trim() && !hasCardiacValues) {
      setError(
        "Missing required patient details! Please enter clinical notes or heart parameters on the dashboard before starting analysis."
      );
      return;
    }
    setError("");

    // 1. Reset cached results from previous runs
    try {
      sessionStorage.removeItem("diagnosisResult");
    } catch (storageErr) {
      console.warn("Unable to clear diagnosisResult from sessionStorage:", storageErr);
    }
    useCDSSStore.getState().setDiagnosisResult(null);
    useCDSSStore.getState().setResult(null);
    resetPipeline();

    const data: PatientFormData = {
      rawText: rawText.trim(),
      cardiacParams: includeCardiac ? cardiacParams : {},
      includeCardiacParams: includeCardiac,
    };
    setFormData(data);

    // 2. Persist fresh patient intake data in sessionStorage
    try {
      sessionStorage.setItem("currentPatientData", JSON.stringify(data));
    } catch (storageErr) {
      console.warn("Unable to save currentPatientData to sessionStorage:", storageErr);
    }

    router.push("/analyze");
  };

  const loadExample = () => {
    setRawText(EXAMPLE_NOTE);
    setIncludeCardiac(true);
    setCardiacParams({
      age: 58, sex: 1, cp: 0, trestbps: 148, chol: 220,
      fbs: 0, restecg: 1, thalach: 142, exang: 1,
      oldpeak: 2.3, slope: 1, ca: 1, thal: 7,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-6 space-y-6">

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Clinical Case Input</h2>
            <p className="text-sm text-slate-500">Enter fictional or appropriately de-identified patient information</p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadExample}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 hover:border-blue-300 px-4 py-2 rounded-lg transition bg-blue-50 hover:bg-blue-100"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Load Example
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="text-amber-600 text-lg mt-0.5">⚠️</div>
        <div className="text-sm text-amber-800">
          <strong>Research Prototype Disclaimer:</strong> TrustCare is an unvalidated research system and
          must <strong>not</strong> be used for real clinical decisions. Only fictional or appropriately
          de-identified cases should be entered. This tool does not provide medical advice or diagnosis.
        </div>
      </div>

      {/* Missing Details Prompt Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-4 shadow-sm animate-shake">
          <div className="text-red-600 text-lg mt-0.5">⚠️</div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-red-900">Validation Notice</p>
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Clinical notes section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
        <div>
          <label className="block text-sm font-semibold text-slate-800 mb-1">
            Clinical Notes <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-slate-500 mb-2">
            Free-text narrative — symptoms, duration, history, lab results, medications. The AI Clarifier
            will extract and normalise structured entities.
          </p>
          <textarea
            rows={7}
            value={rawText}
            onChange={(e) => { setRawText(e.target.value); setError(""); }}
            placeholder={`e.g. "${EXAMPLE_NOTE.slice(0, 100)}..."`}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition resize-none bg-slate-50 focus:bg-white"
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <div className="flex justify-between mt-1.5">
            <p className="text-[11px] text-slate-400">Min. ~20 characters for meaningful analysis</p>
            <p className="text-[11px] text-slate-400">{rawText.length} chars</p>
          </div>
        </div>
      </div>

      {/* Cardiac parameters */}
      <CardiacParametersPanel
        value={cardiacParams}
        onChange={setCardiacParams}
        enabled={includeCardiac}
        onToggle={setIncludeCardiac}
      />

      {/* Submit */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-500 max-w-xs">
          The pipeline runs 4–5 AI agents sequentially; expect 30–120 seconds depending on API load.
        </p>
        <button
          type="submit"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold px-6 py-3 rounded-xl transition shadow-md hover:shadow-lg text-sm"
        >
          <Send className="w-4 h-4" />
          Run Diagnostic Pipeline
        </button>
      </div>
    </form>
  );
}
