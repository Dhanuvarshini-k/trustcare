"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type { CardiacParams } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: CardiacParams;
  onChange: (v: CardiacParams) => void;
  enabled: boolean;
  onToggle: (v: boolean) => void;
}

const field = (
  label: string,
  key: keyof CardiacParams,
  tip: string,
  type: "number" | "select",
  options?: { label: string; value: number }[]
) => ({ label, key, tip, type, options });

const FIELDS = [
  field("Sex", "sex", "Biological sex (0 = female, 1 = male)", "select", [
    { label: "Female (0)", value: 0 },
    { label: "Male (1)", value: 1 },
  ]),
  field("Chest Pain Type", "cp", "0=Typical angina, 1=Atypical angina, 2=Non-anginal pain, 3=Asymptomatic", "select", [
    { label: "0 — Typical Angina", value: 0 },
    { label: "1 — Atypical Angina", value: 1 },
    { label: "2 — Non-anginal Pain", value: 2 },
    { label: "3 — Asymptomatic", value: 3 },
  ]),
  field("Resting BP (mm Hg)", "trestbps", "Resting blood pressure on admission", "number"),
  field("Serum Cholesterol (mg/dl)", "chol", "Serum cholestoral in mg/dl", "number"),
  field("Fasting Blood Sugar >120 mg/dl", "fbs", "1 = true; 0 = false", "select", [
    { label: "No (0)", value: 0 },
    { label: "Yes (1)", value: 1 },
  ]),
  field("Resting ECG", "restecg", "0=Normal, 1=ST-T abnormality, 2=Left ventricular hypertrophy", "select", [
    { label: "0 — Normal", value: 0 },
    { label: "1 — ST-T Wave Abnormality", value: 1 },
    { label: "2 — LV Hypertrophy", value: 2 },
  ]),
  field("Max Heart Rate Achieved", "thalach", "Maximum heart rate achieved during exercise", "number"),
  field("Exercise-Induced Angina", "exang", "1 = yes; 0 = no", "select", [
    { label: "No (0)", value: 0 },
    { label: "Yes (1)", value: 1 },
  ]),
  field("ST Depression (Oldpeak)", "oldpeak", "ST depression induced by exercise relative to rest (0.0–6.2)", "number"),
  field("Slope of Peak Exercise ST", "slope", "0=Upsloping, 1=Flat, 2=Downsloping", "select", [
    { label: "0 — Upsloping", value: 0 },
    { label: "1 — Flat", value: 1 },
    { label: "2 — Downsloping", value: 2 },
  ]),
  field("Num. Major Vessels (CA)", "ca", "Number of major vessels colored by fluoroscopy (0–3)", "select", [
    { label: "0", value: 0 }, { label: "1", value: 1 },
    { label: "2", value: 2 }, { label: "3", value: 3 },
  ]),
  field("Thalassemia (Thal)", "thal", "3 = normal; 6 = fixed defect; 7 = reversable defect", "select", [
    { label: "3 — Normal", value: 3 },
    { label: "6 — Fixed Defect", value: 6 },
    { label: "7 — Reversable Defect", value: 7 },
  ]),
];

export default function CardiacParametersPanel({ value, onChange, enabled, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false);

  const handleChange = (key: keyof CardiacParams, raw: string) => {
    const num = raw === "" ? null : parseFloat(raw);
    onChange({ ...value, [key]: num });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={enabled}
              onChange={(e) => { onToggle(e.target.checked); if (e.target.checked) setExpanded(true); }}
            />
            <div className="w-9 h-5 bg-slate-300 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
          </label>
          <div>
            <p className="text-sm font-semibold text-slate-800">Cleveland Cardiac Parameters</p>
            <p className="text-xs text-slate-500">Optional — enables the heart disease risk model</p>
          </div>
        </div>
        {enabled && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Collapse</> : <><ChevronDown className="w-3.5 h-3.5" /> Expand</>}
          </button>
        )}
      </div>

      {/* Parameter grid */}
      {enabled && expanded && (
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FIELDS.map(({ label, key, tip, type, options }) => (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <label className="text-xs font-medium text-slate-700">{label}</label>
                <div className="group relative">
                  <Info className="w-3 h-3 text-slate-400 cursor-help" />
                  <div className="absolute bottom-5 left-0 z-10 hidden group-hover:block w-52 bg-slate-800 text-white text-[11px] rounded-lg p-2 shadow-xl leading-tight">
                    {tip}
                  </div>
                </div>
              </div>
              {type === "select" && options ? (
                <select
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition text-slate-800"
                  value={value[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                >
                  <option value="">— select —</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  step="any"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition text-slate-800"
                  value={value[key] ?? ""}
                  onChange={(e) => handleChange(key, e.target.value)}
                  placeholder="—"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
