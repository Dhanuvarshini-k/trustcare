import axios from "axios";
import type { DiagnoseResult, ClarifiedData, CardiacParams, SSEEvent } from "./types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 180_000,
  headers: { "Content-Type": "application/json" },
});

export async function checkHealth() {
  const { data } = await apiClient.get("/api/health");
  return data;
}

export async function clarifyText(rawText: string): Promise<ClarifiedData> {
  const { data } = await apiClient.post("/api/clarify", { raw_text: rawText });
  return data.clarified_data;
}

export async function diagnose(
  rawText: string,
  cardiacParams?: CardiacParams | null
): Promise<DiagnoseResult> {
  const { data } = await apiClient.post("/api/diagnose", {
    raw_text: rawText,
    cardiac_params: cardiacParams ?? null,
  });
  return data;
}

/**
 * Opens a streaming fetch connection to POST /api/diagnose/stream.
 * Calls onEvent for each parsed SSE event. Returns a cleanup function.
 */
export function streamDiagnose(
  rawText: string,
  cardiacParams: CardiacParams | null,
  onEvent: (event: SSEEvent) => void,
  onError: (err: string) => void,
  onDone: () => void
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/diagnose/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText, cardiac_params: cardiacParams }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        onError(`HTTP ${res.status}: ${res.statusText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            onEvent(event);
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      onError(err instanceof Error ? err.message : "Stream failed");
    } finally {
      onDone();
    }
  })();

  return () => controller.abort();
}
