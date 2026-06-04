import { cfg } from "./config";

export interface LlmDecision {
  direction: "UP" | "DOWN" | "FLAT";
  predictedBps: number;
  confidence: number;
  rationale: string;
}

export function llmAvailable(): boolean {
  return cfg.llm.apiKey.length > 0;
}

/// Ask any OpenAI-compatible endpoint (AltLLM by default) for a structured call.
/// Returns null on any failure so the brain can fall back to the heuristic.
export async function llmDecide(system: string, user: string): Promise<LlmDecision | null> {
  if (!llmAvailable()) return null;
  try {
    const res = await fetch(`${cfg.llm.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.llm.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.llm.model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const txt: string | undefined = data?.choices?.[0]?.message?.content;
    if (!txt) return null;
    return normalize(extractJson(txt));
  } catch {
    return null;
  }
}

function extractJson(txt: string): any {
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : txt;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalize(p: any): LlmDecision | null {
  if (!p || typeof p !== "object") return null;
  let bps = Number(p.predictedBps ?? p.bps ?? 0);
  if (!Number.isFinite(bps)) bps = 0;
  bps = Math.max(-2000, Math.min(2000, Math.round(bps)));

  let conf = Number(p.confidence ?? 50);
  if (!Number.isFinite(conf)) conf = 50;
  conf = Math.max(1, Math.min(100, Math.round(conf)));

  let dir = String(p.direction ?? (bps > 0 ? "UP" : bps < 0 ? "DOWN" : "FLAT")).toUpperCase();
  if (!["UP", "DOWN", "FLAT"].includes(dir)) dir = bps > 0 ? "UP" : bps < 0 ? "DOWN" : "FLAT";

  // keep the bps sign consistent with the stated direction
  if (dir === "UP" && bps <= 0) bps = Math.max(1, Math.abs(bps));
  if (dir === "DOWN" && bps >= 0) bps = -Math.max(1, Math.abs(bps));
  if (dir === "FLAT") bps = 0;

  return {
    direction: dir as LlmDecision["direction"],
    predictedBps: bps,
    confidence: conf,
    rationale: String(p.rationale ?? p.reason ?? "").slice(0, 600),
  };
}
