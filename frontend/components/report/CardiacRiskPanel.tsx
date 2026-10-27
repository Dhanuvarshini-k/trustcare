"use client";

import React, { useState } from "react";
import {
  Heart,
  AlertTriangle,
  Info,
  CheckCircle2,
  HelpCircle,
  Activity,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { CardiacRisk, CardiacFeatureDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  cardiacRisk: CardiacRisk | null;
}

export default function CardiacRiskPanel({ cardiacRisk }: Props) {
  const [showAllParams, setShowAllParams] = useState(false);

  if (!cardiacRisk || cardiacRisk.risk_level === "Unknown") {
    return (
      <div className="space-y-4">
        {/* Missing Clinical Tests Warning Banner */}
        <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-5 text-amber-900 shadow-sm space-y-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Missing Clinical Tests Notice
              </h4>
              <p className="text-sm font-semibold text-amber-800">
                ECG, Troponin, and Cardiac Imaging were NOT provided in the patient intake.
              </p>
              <p className="text-xs text-amber-700">
                Cleveland Heart Disease Model features were omitted. Diagnostic evaluation requires physical examination, 12-lead electrocardiography, and cardiac biomarker assays.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Experimental Model Risk Prediction (Cleveland Logistic Regression)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cleveland cardiac parameters were omitted for this case. Logistic regression risk scoring was bypassed.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { probability, prediction, risk_level, feature_details, input_parameters } = cardiacRisk;
  const probVal = probability !== null ? (probability > 1 ? probability : probability * 100) : null;
  const probPercent = probVal !== null ? probVal.toFixed(1) : "N/A";

  // Derive missing tests
  const missingTestsFromMeta = feature_details
    ? Object.entries(feature_details)
        .filter(([_, meta]) => meta.is_imputed)
        .map(([k, meta]) => meta.feature_name || k)
    : [];

  const missingList = missingTestsFromMeta.length > 0
    ? missingTestsFromMeta
    : ["Resting ECG", "Cardiac Troponin", "Thallium Stress Scintigraphy", "Coronary Angiography"];

  const paramEntries: [string, CardiacFeatureDetail][] = feature_details
    ? (Object.entries(feature_details) as [string, CardiacFeatureDetail][])
    : (Object.entries(input_parameters || {}).map(([k, v]) => [
        k,
        {
          value: v,
          is_imputed: v === null || v === undefined,
          label: v === null || v === undefined ? "Assumed Baseline (Not Provided)" : "Directly Provided",
          feature_name: k.toUpperCase(),
        } as CardiacFeatureDetail,
      ]) as [string, CardiacFeatureDetail][]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-6">
      {/* 1. Header & Experimental Framing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl mt-0.5 shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800">
                Experimental Model Risk Prediction (Cleveland Logistic Regression)
              </h3>
              <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded">
                Supervised ML
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              <strong>{probPercent}%</strong> reflects an uncalibrated experimental ML model output based on partial inputs and assumed baseline parameters, <strong>NOT</strong> a confirmed clinical diagnosis.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          <span
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 shadow-sm",
              risk_level === "High" && "bg-red-50 text-red-700 border-red-200",
              risk_level === "Moderate" && "bg-amber-50 text-amber-700 border-amber-200",
              risk_level === "Low" && "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}
          >
            <Activity className="w-3.5 h-3.5" />
            {risk_level} Statistical Risk
          </span>
        </div>
      </div>

      {/* 2. BLOCK A: ML Risk Output Gauge & Classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-50/70 p-5 rounded-xl border border-slate-100">
        {/* Probability Gauge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">
              Experimental Heart Disease Risk Score
            </span>
            <span className="text-xl font-black text-slate-900 font-mono">
              {probability !== null ? `${probPercent}%` : "N/A"}
            </span>
          </div>

          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden shadow-inner">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                risk_level === "High" && "bg-gradient-to-r from-amber-500 to-red-600",
                risk_level === "Moderate" && "bg-gradient-to-r from-yellow-400 to-amber-500",
                risk_level === "Low" && "bg-gradient-to-r from-emerald-400 to-emerald-600"
              )}
              style={{
                width: `${Math.min(100, Math.max(0, probVal || 0))}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0% Low</span>
            <span>35% Moderate</span>
            <span>65% High</span>
            <span>100%</span>
          </div>
        </div>

        {/* Classification & Context */}
        <div className="flex flex-col justify-center space-y-1 sm:border-l sm:border-slate-200 sm:pl-5">
          <span className="text-xs font-semibold text-slate-500">
            Cleveland Model Logistic Binary Prediction:
          </span>
          <p className="text-sm font-bold text-slate-800">
            {prediction === 1 ? (
              <span className="text-red-700">Target = 1 (Statistical Markers Align with Ischemia / CAD)</span>
            ) : (
              <span className="text-emerald-700">Target = 0 (No Angiographic Heart Disease Indicated)</span>
            )}
          </p>
          <p className="text-[11px] text-slate-500 leading-normal">
            Trained on 13 features (UCI Cleveland Heart Disease dataset). Not calibrated for prospective bedside triage without confirmatory testing.
          </p>
        </div>
      </div>

      {/* 3. BLOCK C: Missing Clinical Tests & Imputation Warning Banner */}
      <div className="bg-amber-50/80 border-2 border-amber-300 rounded-xl p-4 text-amber-900 space-y-2 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Missing Clinical Tests &amp; Imputation Notice
              </h4>
              <span className="text-[10px] bg-amber-200/80 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                {missingList.length} Absent Tests
              </span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>ECG, Troponin, and Cardiac Imaging were NOT provided</strong> in the intake record. Absent parameters were substituted using median baseline imputation from the Cleveland clinical training cohort.
            </p>
            <div className="pt-1 flex flex-wrap gap-1.5">
              {missingList.map((testName, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] bg-white border border-amber-300 text-amber-900 font-medium px-2 py-0.5 rounded-md shadow-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {testName}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Cleveland Feature Table with Imputation Badges */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Model Feature Breakdown &amp; Data Provenance
            </h4>
          </div>
          <button
            onClick={() => setShowAllParams((prev) => !prev)}
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
          >
            {showAllParams ? (
              <>Show Less <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>View All 13 Parameters <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(showAllParams ? paramEntries : paramEntries.slice(0, 6)).map(([key, item]) => {
            const isImputed = Boolean(item?.is_imputed);
            return (
              <div
                key={key}
                className={cn(
                  "p-3 rounded-xl border text-xs flex flex-col justify-between transition",
                  isImputed
                    ? "bg-slate-50/70 border-slate-200 text-slate-700"
                    : "bg-white border-blue-200 text-slate-800 shadow-xs"
                )}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div>
                    <span className="font-bold text-slate-800 block truncate max-w-[150px]">
                      {item?.feature_name || key.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 uppercase">
                      {key} {item?.unit ? `(${item.unit})` : ""}
                    </span>
                  </div>

                  {isImputed ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                      [Imputed Default]
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      [User Provided]
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">Assigned Value:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {item?.value !== null && item?.value !== undefined ? String(item.value) : "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
