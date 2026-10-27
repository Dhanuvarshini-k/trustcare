// ─── Core clinical data types ─────────────────────────────────────────────────

export interface Demographics {
  age: number | null;
  gender: string | null;
}

export interface ClarifiedData {
  demographics: Demographics;
  symptoms: string[];
  duration: string | null;
  medical_history: string[];
  travel_or_exposure_history: string | null;
  lab_results: string[];
  imaging_findings: string[];
  medications: string[];
  raw_input: string;
  clarification_error?: string;
}

export interface RAGDiagnosis {
  condition: string;
  supporting_sources: number[];
  reasoning: string;
}

export interface RetrievedEvidence {
  pmid: string;
  title: string;
  abstract: string;
  condition_tag: string;
  similarity_score: number;
  lexical_overlap: number;
  url: string | null;
}

export interface RAGOutput {
  diagnoses: RAGDiagnosis[];
  retrieved_evidence: RetrievedEvidence[];
  insufficient_evidence: boolean;
  message?: string;
  error?: string;
  retrieval_note?: string;
  limitations?: string[];
}

export interface WebEvidenceItem {
  condition: string;
  summary: string;
  source_urls: string[];
  evidence_strength: string;
  source_tiers?: string[];
}

export interface WebOutput {
  web_evidence_summary: WebEvidenceItem[];
  insufficient_evidence: boolean;
  limitations?: string[];
  error?: string;
  message?: string;
}

export interface FusedDiagnosis {
  condition: string;
  status: string;
  confidence: number | null;
  supporting_pmids: string[];
  web_source_urls: string[];
  conflicts: string;
  missing_information: string[];
}

export interface FusedOutput {
  final_diagnoses: FusedDiagnosis[];
  overall_confidence: number | null;
  meets_threshold: boolean;
  insufficient_evidence: boolean;
  limitations: string[];
  confidence_note: string;
  emergency_guidance: string[];
  stage_errors?: Record<string, string>;
  biomistral_analysis?: string;
}

export interface CardiacFeatureDetail {
  value: number | null;
  is_imputed: boolean;
  label: string;
  feature_name?: string;
  category?: string;
  unit?: string;
}

export interface CardiacRisk {
  probability: number | null;
  prediction: number | null;
  risk_level: "High" | "Moderate" | "Low" | "Unknown";
  input_parameters: Record<string, number | null>;
  feature_details?: Record<string, CardiacFeatureDetail>;
  missing_tests?: string[];
  missing_clinical_tests_summary?: string;
  error?: string;
}

export interface AgentTrace {
  agent: string;
  status: "done" | "error" | "skipped" | "triggered";
  duration_ms: number;
  error?: string;
}

export interface DiagnoseResult {
  clarified_data: ClarifiedData;
  rag_output: RAGOutput;
  web_output: WebOutput;
  fused_output: FusedOutput;
  cardiac_risk: CardiacRisk | null;
  adaptive_loop_triggered: boolean;
  agent_traces: AgentTrace[];
}

// ─── Form / UI types ─────────────────────────────────────────────────────────

export interface CardiacParams {
  age?: number | null;
  sex?: number | null;
  cp?: number | null;
  trestbps?: number | null;
  chol?: number | null;
  fbs?: number | null;
  restecg?: number | null;
  thalach?: number | null;
  exang?: number | null;
  oldpeak?: number | null;
  slope?: number | null;
  ca?: number | null;
  thal?: number | null;
}

export interface PatientFormData {
  rawText: string;
  cardiacParams: CardiacParams;
  includeCardiacParams: boolean;
}

// ─── SSE / Pipeline stream types ─────────────────────────────────────────────

export type AgentStepKey =
  | "clarifier"
  | "rag_analyzer"
  | "evidence_scanner"
  | "data_fusion"
  | "cardiac_model"
  | "adaptive_optimizer";

export type AgentStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped"
  | "triggered";

export interface AgentStepState {
  step: AgentStepKey;
  status: AgentStatus;
  duration_ms?: number;
  error?: string;
}

export interface SSEEvent {
  step: AgentStepKey | "complete";
  status?: string;
  duration_ms?: number;
  error?: string;
  result?: Omit<DiagnoseResult, "agent_traces">;
}
