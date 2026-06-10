import { clamp } from "@turing-arena/shared";

/// A strategy a user picks when they deploy an agent. Each maps a live momentum
/// read in [-1,1] to a net conviction in [-1,1], mirroring the house agents'
/// styles so a user agent competes on the same footing.
export interface Strategy {
  id: string;
  label: string; // becomes the agent's "model" on the card + leaderboard
  blurb: string; // one-liner in the picker
  bias: (mom: number) => number;
}

export const STRATEGIES: Strategy[] = [
  { id: "momentum", label: "trend-follower", blurb: "Leans hard into the prevailing move.", bias: (m) => m * 1.7 },
  { id: "contrarian", label: "mean-reversion", blurb: "Fades the crowd, bets on the snap-back.", bias: (m) => -m * 1.1 },
  { id: "fusion", label: "multi-signal fusion", blurb: "Blends momentum with a measured long tilt.", bias: (m) => 0.25 + m * 0.5 },
  { id: "long", label: "structural long", blurb: "Structurally bullish, sizes by momentum.", bias: (m) => 0.35 + m * 0.25 },
  { id: "scout", label: "signal scout", blurb: "Light, single-signal, long-leaning.", bias: (m) => 0.15 + m * 0.6 },
];

export function strategyById(id: string | undefined): Strategy {
  return STRATEGIES.find((s) => s.id === id) ?? STRATEGIES[2];
}

export interface AgentCall {
  direction: "UP" | "DOWN";
  predictedBps: number;
  confidence: number;
  rationale: string;
}

/// Turn a strategy + a live momentum read into a concrete sealed call.
export function computeCall(strat: Strategy, mom: number): AgentCall {
  const net = clamp(strat.bias(mom), -1, 1);
  let predictedBps = Math.round(net * 500);
  if (predictedBps === 0) predictedBps = net >= 0 ? 1 : -1;
  const confidence = Math.max(1, Math.min(100, Math.round((0.35 + 0.6 * Math.abs(net)) * 100)));
  const direction: "UP" | "DOWN" = predictedBps >= 0 ? "UP" : "DOWN";
  const lean = net > 0.05 ? "bullish" : net < -0.05 ? "bearish" : "flat";
  const rationale = `${strat.label}: ${lean} read (${net.toFixed(2)}) on ETH momentum ${mom >= 0 ? "+" : ""}${mom.toFixed(2)}.`;
  return { direction, predictedBps, confidence, rationale };
}

// --------------------------------------------------------------------------- //
//  Bring your own LLM (optional) + custom personality
// --------------------------------------------------------------------------- //

/// An OpenAI-compatible LLM the user wires to their OWN agent. Stored only in
/// this browser (localStorage); the key never reaches our server or the chain.
export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const LLM_KEY = "ta:llm";

export function saveLlmConfig(c: LlmConfig) {
  try {
    localStorage.setItem(LLM_KEY, JSON.stringify(c));
  } catch {}
}
export function loadLlmConfig(): LlmConfig | null {
  try {
    const raw = localStorage.getItem(LLM_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as LlmConfig;
    return c.baseUrl && c.apiKey && c.model ? c : null;
  } catch {
    return null;
  }
}
export function clearLlmConfig() {
  try {
    localStorage.removeItem(LLM_KEY);
  } catch {}
}

/// Ask the user's own LLM (client-side, key stays in the browser) to make this
/// agent's call IN CHARACTER. Returns null on any failure (e.g. a CORS-blocked
/// endpoint) so the caller falls back to the deterministic strategy.
export async function llmCall(persona: string, mom: number, price: number, cfg: LlmConfig): Promise<AgentCall | null> {
  const character = persona.trim() || "a disciplined trading agent";
  const system = [
    `You are ${character}.`,
    "You compete in Turing Arena, an on-chain prediction benchmark whose market rotates each round — crypto prices (mETH, BTC, SOL, MNT) and live novelty feeds (CS2 players online, Ethereum gas, the BTC mempool). You COMMIT a directional call you cannot take back, then it settles against a live oracle.",
    'Respond with ONLY a JSON object: {"direction":"UP|DOWN","predictedBps":<signed int, expected move in basis points, |value|<=2000>,"confidence":<int 1-100>,"rationale":"<=2 sentences, in character"}',
  ].join(" ");
  const user = `This round's market value is near ${price.toLocaleString(undefined, { maximumFractionDigits: price < 10 ? 4 : 0 })}. Recent momentum reads ${mom >= 0 ? "+" : ""}${mom.toFixed(2)} on a -1..1 scale. Make your call, in character.`;
  try {
    const res = await fetch(`${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        temperature: 0.5,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const txt = data?.choices?.[0]?.message?.content;
    return txt ? normalizeLlm(txt) : null;
  } catch {
    return null;
  }
}

function normalizeLlm(txt: string): AgentCall | null {
  const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const cand = fenced ? fenced[1] : txt;
  const s = cand.indexOf("{");
  const e = cand.lastIndexOf("}");
  if (s === -1 || e === -1 || e < s) return null;
  let p: { predictedBps?: unknown; bps?: unknown; confidence?: unknown; direction?: unknown; rationale?: unknown; reason?: unknown };
  try {
    p = JSON.parse(cand.slice(s, e + 1));
  } catch {
    return null;
  }
  let bps = Math.round(Number(p.predictedBps ?? p.bps ?? 0));
  if (!Number.isFinite(bps)) bps = 0;
  bps = Math.max(-2000, Math.min(2000, bps));
  let conf = Math.round(Number(p.confidence ?? 50));
  if (!Number.isFinite(conf)) conf = 50;
  conf = Math.max(1, Math.min(100, conf));
  let dir = String(p.direction ?? (bps >= 0 ? "UP" : "DOWN")).toUpperCase();
  if (dir !== "UP" && dir !== "DOWN") dir = bps >= 0 ? "UP" : "DOWN";
  if (dir === "UP" && bps <= 0) bps = Math.max(1, Math.abs(bps));
  if (dir === "DOWN" && bps >= 0) bps = -Math.max(1, Math.abs(bps));
  const rationale = String(p.rationale ?? p.reason ?? "LLM call").slice(0, 280);
  return { direction: dir as "UP" | "DOWN", predictedBps: bps, confidence: conf, rationale };
}

const PYTH_ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";
const PRIOR_KEY = "ta:pyth:lastEth";

/// Live ETH/USD momentum in [-1,1] from Pyth Hermes, derived tick-to-tick against
/// a per-browser cached prior (mirrors the keeper's momentum signal). Falls back
/// to a flat 0 if the price feed can't be reached.
export async function fetchMomentum(): Promise<number> {
  try {
    const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_ETH_USD}`, {
      cache: "no-store",
    });
    if (!res.ok) return 0;
    const j = (await res.json()) as { parsed?: { price?: { price?: string; expo?: number } }[] };
    const p = j.parsed?.[0]?.price;
    if (!p?.price || typeof p.expo !== "number") return 0;
    const price = Number(p.price) * 10 ** p.expo;
    if (!Number.isFinite(price) || price <= 0) return 0;

    let prior = 0;
    try {
      prior = Number(localStorage.getItem(PRIOR_KEY) ?? "0");
      localStorage.setItem(PRIOR_KEY, String(price));
    } catch {
      /* storage blocked; momentum just reads flat-ish */
    }
    if (!prior || prior <= 0) return 0;
    const chg = (price - prior) / prior;
    return clamp(chg * 120, -1, 1);
  } catch {
    return 0;
  }
}
