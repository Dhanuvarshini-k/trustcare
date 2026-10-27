"use client";

import React from "react";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  FileSearch,
  BookOpen,
  Globe,
  BrainCircuit,
  Heart,
  Scale,
} from "lucide-react";
import { useCDSSStore } from "@/lib/store";
import type { AgentStepKey, AgentStatus, AgentStepState } from "@/lib/types";
import { formatMs, cn } from "@/lib/utils";

interface StepConfig {
  key: AgentStepKey;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEP_CONFIGS: StepConfig[] = [
  {
    key: "clarifier",
    label: "Clarifier",
    sublabel: "Extracts structured clinical entities and demographics",
    icon: FileSearch,
  },
  {
    key: "rag_analyzer",
    label: "Symptom RAG",
    sublabel: "Dense vector retrieval from PubMed cardiac knowledge base",
    icon: BookOpen,
  },
  {
    key: "evidence_scanner",
    label: "Web Scanner",
    sublabel: "Cross-references live clinical guidelines and evidence",
    icon: Globe,
  },
  {
    key: "data_fusion",
    label: "BioMistral Fusion",
    sublabel: "Biomedical LLM diagnostic reasoning & evidence synthesis",
    icon: BrainCircuit,
  },
  {
    key: "cardiac_model",
    label: "Cardiac Model",
    sublabel: "Cleveland Heart Disease supervised logistic regression",
    icon: Heart,
  },
  {
    key: "adaptive_optimizer",
    label: "Adaptive Optimizer",
    sublabel: "Self-reflective confidence scoring & threshold evaluation",
    icon: Scale,
  },
];

function getBadge(status: AgentStatus) {
  switch (status) {
    case "done":
      return {
        bg: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        text: "Done",
      };
    case "running":
      return {
        bg: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse",
        icon: <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />,
        text: "Running",
      };
    case "error":
      return {
        bg: "bg-red-50 text-red-700 border-red-200",
        icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
        text: "Error",
      };
    case "triggered":
      return {
        bg: "bg-purple-50 text-purple-700 border-purple-200",
        icon: <AlertTriangle className="w-3.5 h-3.5 text-purple-600" />,
        text: "Triggered",
      };
    case "skipped":
      return {
        bg: "bg-slate-50 text-slate-500 border-slate-200",
        icon: <MinusCircle className="w-3.5 h-3.5 text-slate-400" />,
        text: "Skipped",
      };
    case "pending":
    default:
      return {
        bg: "bg-slate-50 text-slate-500 border-slate-200",
        icon: <Clock className="w-3.5 h-3.5 text-slate-400" />,
        text: "Pending",
      };
  }
}

interface Props {
  steps?: AgentStepState[];
}

export default function AgentPipelineVisualizer({ steps: propSteps }: Props) {
  const storeSteps = useCDSSStore((s) => s.agentSteps);
  const steps = propSteps ?? storeSteps;

  const stepMap = new Map(steps.map((s) => [s.step, s]));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Multi-Agent Pipeline Execution
          </h3>
          <p className="text-xs text-slate-500">
            Real-time status tracking across specialized clinical reasoning agents
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">
          {steps.filter((s) => s.status === "done").length} / {steps.length} Completed
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {STEP_CONFIGS.map(({ key, label, sublabel, icon: Icon }, idx) => {
          const state = stepMap.get(key) || { step: key, status: "pending" };
          const badge = getBadge(state.status);
          const isCurrent = state.status === "running";

          return (
            <div
              key={key}
              className={cn(
                "px-6 py-4 flex items-center justify-between transition-colors",
                isCurrent && "bg-blue-50/50"
              )}
            >
              <div className="flex items-center gap-4">
                <span className="w-6 text-center text-xs font-bold text-slate-400 font-mono">
                  0{idx + 1}
                </span>
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center transition",
                    state.status === "done" && "bg-emerald-100 text-emerald-700",
                    state.status === "running" && "bg-blue-100 text-blue-700 ring-2 ring-blue-400 ring-offset-1 animate-pulse",
                    state.status === "error" && "bg-red-100 text-red-700",
                    state.status === "pending" && "bg-slate-100 text-slate-400",
                    state.status === "skipped" && "bg-slate-100 text-slate-400",
                    state.status === "triggered" && "bg-purple-100 text-purple-700"
                  )}
                >
                  {state.status === "running" ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    {state.duration_ms !== undefined && state.duration_ms > 0 && (
                      <span className="text-[11px] font-mono text-slate-400">
                        {formatMs(state.duration_ms)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{sublabel}</p>
                  {state.error && (
                    <p className="text-xs text-red-600 mt-0.5 max-w-md truncate">
                      {state.error}
                    </p>
                  )}
                </div>
              </div>

              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border",
                  badge.bg
                )}
              >
                {badge.icon}
                <span>{badge.text}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
