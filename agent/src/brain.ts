import { type Decision, type Signal, type SignalBundle, clamp, clampInt, fuseSignals } from "@turing-arena/shared";
import { cfg } from "./config";
import { llmAvailable, llmDecide } from "./llm";

/// A competitor identity + decision style. Mirrors the Virtuals GAME shape:
/// the Agent (persona/objective) plans, Workers (signal adapters) gather, and a
/// Function (commit/reveal) acts on-chain.
export interface Persona {
  name: string;
  kind: "AI" | "HUMAN";
  style: string;
  /// Transform the fused net signal in [-1,1] (e.g. contrarian flips the sign).
  bias?: (net: number) => number;
  /// Restrict the brain to specific signal sources, e.g. ["allora"] for a pure
  /// Allora-inference competitor. Empty/undefined = use every signal.
  only?: string[];
  /// Set false to force the pure heuristic brain (deterministic, no LLM).
  useLlm?: boolean;
}

/// The default flagship agent: trusts the full multi-signal fusion.
export const ATHENA: Persona = {
  name: cfg.agentName,
  kind: "AI",
  style:
    "a disciplined multi-signal quant that weighs decentralized ML inference, smart-money flows, social mindshare and live Mantle on-chain data, and sizes conviction by how strongly the signals agree.",
};

export async function decide(bundle: SignalBundle, persona: Persona = ATHENA): Promise<Decision> {
  const filtered = persona.only ? bundle.signals.filter((s) => persona.only!.includes(s.source)) : bundle.signals;
  const signals = filtered.length ? filtered : bundle.signals;
  const base = fuseSignals(signals);
  const net = clamp(persona.bias ? persona.bias(base.net) : base.net, -1, 1);

  // Conviction scales with the (persona-biased) net read, so each persona sizes
  // its bet differently — a trend-follower levers up, the flagship stays measured.
  let predictedBps = Math.round(net * 600);
  let confidence = clampInt((0.3 + 0.7 * Math.abs(net)) * 100, 1, 100);
  let rationale = buildRationale(signals, net);
  let model = "heuristic-fusion";

  if (persona.useLlm !== false && llmAvailable()) {
    const llm = await llmDecide(systemPrompt(persona), userPrompt({ ...bundle, signals }, persona));
    if (llm) {
      predictedBps = llm.predictedBps;
      confidence = llm.confidence;
      if (llm.rationale) rationale = llm.rationale;
      model = `llm:${cfg.llm.model}`;
    }
  }

  const direction = predictedBps > 0 ? "UP" : predictedBps < 0 ? "DOWN" : "FLAT";
  return { direction, predictedBps, confidence, rationale, signals, model };
}

function buildRationale(signals: Signal[], net: number): string {
  const lean = net > 0.05 ? "bullish" : net < -0.05 ? "bearish" : "neutral";
  const ranked = [...signals].sort((a, b) => Math.abs(b.score * b.weight) - Math.abs(a.score * a.weight));
  const top = ranked
    .slice(0, 3)
    .map((s) => `${s.source} ${s.score >= 0 ? "+" : ""}${s.score.toFixed(2)} (${s.note})`)
    .join("; ");
  return `Net read ${lean} (${net.toFixed(2)}). Strongest evidence: ${top}.`;
}

function systemPrompt(p: Persona): string {
  return [
    `You are ${p.name}, ${p.style}`,
    "You compete in Turing Arena, an on-chain benchmark on Mantle. You will COMMIT a",
    "directional price call you cannot take back, then it settles against an oracle.",
    "Respond with ONLY a JSON object:",
    '{"direction":"UP|DOWN|FLAT","predictedBps":<signed int, the expected move in basis points, |value|<=2000>,',
    '"confidence":<int 1-100 = your conviction / bet size>,"rationale":"<=2 sentences citing the signals"}',
  ].join(" ");
}

function userPrompt(bundle: SignalBundle, p: Persona): string {
  const lines = bundle.signals.map(
    (s) => `- ${s.source} (weight ${s.weight}): score ${s.score.toFixed(2)} — ${s.note} [${s.live ? "live" : "mock"}]`,
  );
  return [
    `Asset: ${bundle.asset}. Horizon: this round (minutes to ~1h).`,
    `Your style: ${p.style}`,
    "Signals:",
    ...lines,
    "Make your call.",
  ].join("\n");
}
