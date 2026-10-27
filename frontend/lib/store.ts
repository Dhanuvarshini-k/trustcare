import { create } from "zustand";
import type {
  PatientFormData,
  DiagnoseResult,
  AgentStepState,
  AgentStepKey,
  AgentStatus,
} from "./types";

const INITIAL_STEPS: AgentStepState[] = [
  { step: "clarifier",          status: "pending" },
  { step: "rag_analyzer",       status: "pending" },
  { step: "evidence_scanner",   status: "pending" },
  { step: "data_fusion",        status: "pending" },
  { step: "cardiac_model",      status: "pending" },
  { step: "adaptive_optimizer", status: "pending" },
];

interface CDSSStore {
  // Patient form data (set before navigating to /analyze)
  formData: PatientFormData | null;
  // Final pipeline result (set when SSE stream completes)
  result: DiagnoseResult | null;
  // Live per-agent step states for the pipeline visualizer
  agentSteps: AgentStepState[];
  // Whether the SSE stream is currently active
  isStreaming: boolean;
  // Top-level stream error message, if any
  streamError: string | null;

  setFormData: (data: PatientFormData | null) => void;
  setResult: (result: DiagnoseResult | null) => void;
  setDiagnosisResult: (data: DiagnoseResult | null) => void;
  updateStep: (step: AgentStepKey, update: Partial<AgentStepState>) => void;
  setIsStreaming: (v: boolean) => void;
  setStreamError: (msg: string | null) => void;
  resetPipeline: () => void;
}

export const useCDSSStore = create<CDSSStore>((set) => ({
  formData: null,
  result: null,
  agentSteps: [...INITIAL_STEPS],
  isStreaming: false,
  streamError: null,

  setFormData: (data) => set({ formData: data }),
  setResult: (result) => set({ result }),
  setDiagnosisResult: (data) => set({ result: data }),

  updateStep: (step, update) =>
    set((state) => ({
      agentSteps: state.agentSteps.map((s) =>
        s.step === step ? { ...s, ...update } : s
      ),
    })),

  setIsStreaming: (v) => set({ isStreaming: v }),
  setStreamError: (msg) => set({ streamError: msg }),

  resetPipeline: () =>
    set({
      agentSteps: INITIAL_STEPS.map((s) => ({ ...s })),
      result: null,
      isStreaming: false,
      streamError: null,
    }),
}));

export const useTrustcareStore = useCDSSStore;
