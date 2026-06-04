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
