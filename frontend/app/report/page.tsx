"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  AlertTriangle,
  Heart,
  Brain,
  BookOpen,
  Globe,
  ExternalLink,
  Printer,
  RotateCcw,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle,
} from "lucide-react";
import { useCDSSStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { DiagnoseResult } from "@/lib/types";
import CardiacRiskPanel from "@/components/report/CardiacRiskPanel";

export default function ReportPage() {
  const router = useRouter();
  const { result, setResult, isStreaming, resetPipeline } = useCDSSStore();
  const [reportData, setReportData] = useState<DiagnoseResult | null>(result);
  const [isHydrating, setIsHydrating] = useState(true);
  const [sourcesTab, setSourcesTab] = useState<"pubmed" | "web">("pubmed");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (result) {
      setReportData(result);
      setIsHydrating(false);
      return;
    }
    try {
      const saved = sessionStorage.getItem("diagnosisResult");
      if (saved) {
        const parsed = JSON.parse(saved);
        setReportData(parsed);
        setResult(parsed);
      }
    } catch (e) {
      console.warn("Failed to parse diagnosisResult from sessionStorage:", e);
    }
    setIsHydrating(false);
  }, [result, setResult]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleReturnToIntake = () => {
    resetPipeline();
    try {
      sessionStorage.removeItem("diagnosisResult");
      sessionStorage.removeItem("currentPatientData");
    } catch (e) {
      console.warn("Error clearing sessionStorage on return to intake:", e);
    }
    useCDSSStore.getState().setDiagnosisResult(null);
    useCDSSStore.getState().setResult(null);
    router.push("/dashboard");
  };

  const handleNewAnalysis = handleReturnToIntake;

  // 1. Loading State: Clean full-page skeleton loader / spinner
  if (isStreaming || isHydrating) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-6 animate-pulse">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
              <Activity className="w-7 h-7 animate-spin text-blue-600" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Generating Clinical Diagnostic Synthesis...
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Multi-agent reasoning in progress: PubMed RAG retrieval, live guideline validation, and BioMistral LLM fusion.
            </p>
          </div>
          <div className="w-48 mx-auto bg-slate-200 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-600 h-full w-2/3 animate-pulse rounded-full" />
          </div>
        </div>

        {/* Skeleton Placeholders */}
        <div className="space-y-4">
          <div className="h-16 bg-slate-200/70 rounded-xl" />
          <div className="h-40 bg-slate-200/70 rounded-xl" />
          <div className="h-64 bg-slate-200/70 rounded-xl" />
        </div>
      </div>
    );
  }

  // 2. Error Fallback State: Explicit error alert with [Return to Intake] button
  if (!reportData) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="bg-red-50 border-2 border-red-300 text-red-900 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-xl text-red-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-red-900">
                Diagnostic Report Unavailable
              </h3>
              <p className="text-sm font-semibold text-red-800 leading-relaxed">
                Diagnostic report could not be generated. Ensure api.py backend server is running on http://localhost:8000.
              </p>
              <p className="text-xs text-red-700 mt-1">
                No active diagnostic output was found. Please ensure you have entered patient information and the pipeline completed successfully.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-200 flex items-center justify-between">
            <button
              onClick={handleReturnToIntake}
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl transition shadow-sm text-sm"
            >
              <RotateCcw className="w-4 h-4" /> Return to Intake
            </button>
            <a
              href="http://localhost:8000/api/health"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-red-700 hover:text-red-900 font-medium underline"
            >
              Check Backend Health (Port 8000)
            </a>
          </div>
        </div>
      </div>
    );
  }

  const {
    clarified_data,
    fused_output,
    cardiac_risk,
    rag_output,
    web_output,
    adaptive_loop_triggered,
  } = reportData;

  const emergencyFlags = fused_output?.emergency_guidance || [];
  const finalDiagnoses = fused_output?.final_diagnoses || [];
  const limitations = fused_output?.limitations || [];
  const retrievedEvidence = rag_output?.retrieved_evidence || [];
  const webEvidence = web_output?.web_evidence_summary || [];

  // Dynamically resolve patient demographics from Clarifier output or Cardiac Model parameters
  const patientAge =
    clarified_data?.demographics?.age ??
    cardiac_risk?.input_parameters?.age ??
    "Unknown";

  const rawGender =
    clarified_data?.demographics?.gender ??
    (cardiac_risk?.input_parameters?.sex === 1
      ? "Male"
      : cardiac_risk?.input_parameters?.sex === 0
      ? "Female"
      : null);
  const patientSex = rawGender ? String(rawGender) : "Unknown";

  const patientDuration =
    clarified_data?.duration && clarified_data.duration !== "Unspecified"
      ? clarified_data.duration
      : "Unspecified";

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6 print:p-0 print:space-y-4">
      {/* TASK 4: High-Priority Safety & Emergency Triage Disclaimer */}
      <div className="bg-red-600 text-white p-5 rounded-2xl shadow-lg border-2 border-red-700 flex items-start gap-4">
        <div className="p-2.5 bg-red-700 rounded-xl shrink-0 mt-0.5">
          <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black uppercase tracking-wider text-red-100 flex items-center gap-2">
            <span>Critical Safety Warning — Emergency Evaluation Required</span>
          </h3>
          <p className="text-sm font-bold leading-relaxed text-white">
            CRITICAL SAFETY WARNING: Symptoms such as exertional chest tightness radiating to the arm warrant immediate medical evaluation. Seek emergency care (e.g., call 911 / emergency services) if symptoms are severe, persistent, or worsening.
          </p>
          <p className="text-xs text-red-200 mt-1">
            Do not delay or substitute medical consultation for experimental computational CDSS analysis.
          </p>
        </div>
      </div>

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-600 text-white shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              Clinical Diagnostic Report
            </h1>
            <p className="text-xs text-slate-500">
              TrustCare Multi-Agent CDSS Synthesis • Research Prototype
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 px-3.5 py-2 rounded-xl transition shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Export
          </button>
          <button
            onClick={handleNewAnalysis}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl transition shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" /> New Analysis
          </button>
        </div>
      </div>

      {/* 1. Cardiac Scope Disclaimer Banner */}
      <div className="space-y-3">
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl text-amber-900 text-xs sm:text-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-1">
                Research Prototype Notice &amp; Scope Limitation
              </p>
              <p className="text-amber-800 leading-relaxed text-xs">
                TrustCare is an experimental research system and has <strong>not</strong> been clinically validated or approved by regulatory bodies. It is intended strictly for evaluating multi-agent RAG reasoning on de-identified test cases. <strong>Do not make clinical diagnosis or treatment decisions based on this output.</strong> Always consult a licensed medical clinician.
              </p>
            </div>
          </div>
        </div>

        {emergencyFlags.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-red-700 uppercase tracking-wider mb-1">
                  Urgent Clinical Red Flags Detected
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-red-800">
                  {emergencyFlags.map((flag, idx) => (
                    <li key={idx}>{flag}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient Intake Summary */}
      {clarified_data && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Patient Intake &amp; Structured Clarification
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-3">
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[11px]">Age / Sex</span>
              <span className="font-semibold text-slate-800">
                {patientAge} / {patientSex}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg">
              <span className="text-slate-400 block text-[11px]">Duration</span>
              <span className="font-semibold text-slate-800">
                {patientDuration}
              </span>
            </div>
            <div className="p-2.5 bg-slate-50 rounded-lg col-span-2">
              <span className="text-slate-400 block text-[11px]">Key Symptoms</span>
              <span className="font-semibold text-slate-800 truncate block">
                {clarified_data.symptoms?.length
                  ? clarified_data.symptoms.join(", ")
                  : "None extracted"}
              </span>
            </div>
          </div>
          {clarified_data.raw_input && (
            <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              "{clarified_data.raw_input}"
            </p>
          )}
        </div>
      )}

      {/* BLOCK A & C: ML Risk Output & Missing Clinical Data Flags */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded">
            Block A &amp; C
          </span>
          <span className="text-xs font-bold text-slate-700">
            Machine Learning Risk Prediction &amp; Missing Parameter Audit
          </span>
        </div>
        <CardiacRiskPanel cardiacRisk={cardiac_risk} />
      </div>

      {/* BLOCK B: Guidelines & Literature Evidence Retrieval */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
            Block B
          </span>
          <span className="text-xs font-bold text-slate-700">
            Guidelines &amp; Literature Evidence Retrieval (BioMistral + PubMed + Web)
          </span>
        </div>

        {/* Fused Agent Diagnostic Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Fused Agent Diagnostic Summary
              </h2>
              <p className="text-[11px] text-slate-500">
                Synthesis of RAG retrieval, Web evidence, and BioMistral LLM reasoning
              </p>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {finalDiagnoses.length} Candidates Identified
          </span>
        </div>

        {/* BioMistral Reasoning / Synthesis */}
        {fused_output?.biomistral_analysis && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                BioMistral-7B Clinical Synthesis
              </span>
              {adaptive_loop_triggered && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                  Adaptive Optimizer Triggered
                </span>
              )}
            </div>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {fused_output.biomistral_analysis}
            </p>
          </div>
        )}

        {/* Final Diagnoses Cards */}
        {finalDiagnoses.length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Differential Considerations
            </h4>
            {finalDiagnoses.map((diag, idx) => (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl p-4 hover:border-blue-200 transition bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h5 className="text-sm font-bold text-slate-800">
                      {diag.condition}
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">{diag.status}</p>
                  </div>
                  <span className="text-[11px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    Literature Mention
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 text-[11px] block">
                      Supporting PubMed IDs:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {diag.supporting_pmids?.length > 0 ? (
                        diag.supporting_pmids.map((pmid) => (
                          <a
                            key={pmid}
                            href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline bg-blue-50 px-2 py-0.5 rounded"
                          >
                            PMID:{pmid}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">
                      Missing Clinical Information:
                    </span>
                    <p className="text-slate-600 mt-1">
                      {diag.missing_information?.join(", ") ||
                        "Clinical exam & labs required"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
            No candidate conditions met the strict evidence-citation criteria from the RAG knowledge base.
          </div>
        )}

        {/* Limitations */}
        {limitations.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Systemic Limitations &amp; Caveats
            </h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-slate-500">
              {limitations.map((lim, i) => (
                <li key={i}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 4. Citations & Sources Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Evidence Citations &amp; Sources
              </h2>
              <p className="text-[11px] text-slate-500">
                Retrieved literature passages and live web medical sources
              </p>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSourcesTab("pubmed")}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition",
                sourcesTab === "pubmed"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              PubMed RAG ({retrievedEvidence.length})
            </button>
            <button
              onClick={() => setSourcesTab("web")}
              className={cn(
                "px-3 py-1 rounded-md font-medium transition",
                sourcesTab === "web"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              Web Scanner ({webEvidence.length})
            </button>
          </div>
        </div>

        {/* Tab 1: PubMed RAG Evidence */}
        {sourcesTab === "pubmed" && (
          <div className="space-y-3">
            {retrievedEvidence.length > 0 ? (
              retrievedEvidence.map((ev, i) => (
                <div
                  key={ev.pmid || i}
                  className="border border-slate-100 rounded-xl p-4 bg-slate-50/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {ev.condition_tag || "Cardiac"}
                        </span>
                        <a
                          href={ev.url || `https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline font-mono inline-flex items-center gap-1"
                        >
                          PMID:{ev.pmid}
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                      <h5 className="text-xs font-bold text-slate-800">{ev.title}</h5>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono shrink-0">
                      Sim: {(ev.similarity_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  <p
                    className={cn(
                      "text-xs text-slate-600 mt-2 leading-relaxed transition-all",
                      !expandedCards[ev.pmid] && "line-clamp-2"
                    )}
                  >
                    {ev.abstract}
                  </p>

                  <button
                    onClick={() => toggleExpand(ev.pmid)}
                    className="text-[11px] text-blue-600 hover:underline mt-1 inline-flex items-center gap-0.5"
                  >
                    {expandedCards[ev.pmid] ? (
                      <>Show less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Read abstract <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic p-4">
                No PubMed abstracts were retrieved for this query.
              </p>
            )}
          </div>
        )}

        {/* Tab 2: Web Evidence */}
        {sourcesTab === "web" && (
          <div className="space-y-3">
            {webEvidence.length > 0 ? (
              webEvidence.map((item, idx) => (
                <div
                  key={idx}
                  className="border border-slate-100 rounded-xl p-4 bg-slate-50/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-bold text-slate-800">
                      {item.condition}
                    </h5>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-medium">
                      Strength: {item.evidence_strength || "Standard"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mb-2 leading-relaxed">
                    {item.summary}
                  </p>
                  {item.source_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                      {item.source_urls.map((url, uidx) => (
                        <a
                          key={uidx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 max-w-xs truncate"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span className="truncate">{url}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic p-4">
                No web guideline scans recorded for this query.
              </p>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
