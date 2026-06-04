import type { Signal } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, fetchJson, hourBucket, mockScore } from "./util";

const WEIGHT = 0.1; // Surf AI unified market/social data

export async function surfSignal(asset: string, seed: string | number = hourBucket()): Promise<Signal> {
  if (cfg.signals.surf.key) {
    const live = await tryLive(asset);
    if (live) return live;
  }
  const score = mockScore("surf", asset, seed);
  return {
    source: "surf",
    score,
    weight: WEIGHT,
    live: false,
    note: `Market momentum ${score >= 0 ? "positive" : "negative"}`,
  };
}

async function tryLive(asset: string): Promise<Signal | null> {
  const { base, key } = cfg.signals.surf;
  const sym = asset.split("/")[0];
  const data = await fetchJson<any>(`${base}/gateway/market/momentum?symbol=${encodeURIComponent(sym)}`, {
    headers: { authorization: `Bearer ${key}`, accept: "application/json" },
  });
  const m = Number(data?.momentum ?? data?.data?.momentum ?? data?.change24h);
  if (!Number.isFinite(m)) return null;
  const score = clamp(Math.tanh(m / 10));
  return { source: "surf", score, weight: WEIGHT, live: true, note: `Surf momentum ${m}`, raw: data };
}
