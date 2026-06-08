import type { Signal } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, fetchJson, hourBucket, mockScore } from "./util";

const WEIGHT = 0.35; // a real prediction market's crowd-implied odds — a strong signal

/// Arena asset symbol -> Limitless market ticker (mETH settles on ETH).
const TICKER: Record<string, string> = {
  "METH/USD": "ETH",
  "ETH/USD": "ETH",
  "BTC/USD": "BTC",
  "SOL/USD": "SOL",
  "MNT/USD": "MNT",
};

interface LimitlessMarket {
  title?: string;
  slug?: string;
  prices?: number[]; // [upProb, downProb] in 0..1 — token order is {yes/up, no/down}
}

/// Limitless Exchange (Base) prediction-market signal: the live, crowd-implied
/// probability that the asset goes UP, read from its recurring
/// "<TICKER> Up or Down" market. `prices[0]` is the Up (yes) share price ≈ the
/// implied probability; we map it to a bounded score (0.5 -> 0, 1 -> +1, 0 -> -1).
/// Public API, no key required — anyone can verify the same number at
/// api.limitless.exchange/markets/active. Falls back to a deterministic mock when
/// the asset has no Limitless market (e.g. MNT) or the API is unreachable.
export async function limitlessSignal(
  asset: string,
  seed: string | number = hourBucket(),
): Promise<Signal> {
  const ticker = TICKER[asset];
  if (ticker) {
    const live = await tryLive(ticker);
    if (live) return live;
  }
  const score = mockScore("limitless", asset, seed);
  return {
    source: "limitless",
    score,
    weight: WEIGHT,
    live: false,
    note: ticker
      ? `Limitless ${ticker} market unavailable — mock ${score >= 0 ? "up" : "down"}`
      : `No Limitless market for ${asset} — mock ${score >= 0 ? "up" : "down"}`,
  };
}

const horizonMin = (title?: string): number => {
  const m = /(\d+)\s*Min/i.exec(title ?? "");
  return m ? Number(m[1]) : 9999;
};

async function tryLive(ticker: string): Promise<Signal | null> {
  const data = await fetchJson<{ data?: LimitlessMarket[] }>(
    `${cfg.signals.limitless.base}/markets/active`,
    { headers: { accept: "application/json" } },
  );
  const markets = data?.data;
  if (!Array.isArray(markets)) return null;

  const re = new RegExp(`^${ticker}\\s+Up or Down`, "i");
  const candidates = markets.filter(
    (m) => typeof m.title === "string" && re.test(m.title) && Array.isArray(m.prices) && m.prices.length >= 2,
  );
  if (candidates.length === 0) return null;
  // Prefer the ~15-min market: it's the closest horizon to the arena's round and
  // the most reliably-listed (the 5-min markets roll over every few minutes).
  candidates.sort((a, b) => Math.abs(horizonMin(a.title) - 15) - Math.abs(horizonMin(b.title) - 15));
  const m = candidates[0];

  const upProb = Number(m.prices?.[0]);
  if (!Number.isFinite(upProb) || upProb < 0 || upProb > 1) return null;
  const score = clamp((upProb - 0.5) * 2);
  const pct = Math.round(upProb * 100);
  return {
    source: "limitless",
    score,
    weight: WEIGHT,
    live: true,
    note: `Limitless (Base) ${ticker} ${pct}% up / ${100 - pct}% down`,
    raw: { title: m.title, slug: m.slug, prices: m.prices, upProb },
  };
}
