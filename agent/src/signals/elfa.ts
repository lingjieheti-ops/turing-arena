import type { Signal } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, fetchJson, hourBucket, mockScore } from "./util";

const WEIGHT = 0.15; // Elfa AI social / KOL sentiment

export async function elfaSignal(asset: string, seed: string | number = hourBucket()): Promise<Signal> {
  if (cfg.signals.elfa.key) {
    const live = await tryLive(asset);
    if (live) return live;
  }
  const score = mockScore("elfa", asset, seed);
  return {
    source: "elfa",
    score,
    weight: WEIGHT,
    live: false,
    note: `KOL mindshare ${score >= 0 ? "heating up" : "cooling"}`,
  };
}

async function tryLive(asset: string): Promise<Signal | null> {
  const { base, key } = cfg.signals.elfa;
  const sym = asset.split("/")[0];
  const data = await fetchJson<any>(`${base}/v2/aggregations/trending-tokens?timeWindow=24h`, {
    headers: { "x-elfa-api-key": key, accept: "application/json" },
  });
  const rows: any[] = data?.data?.data ?? data?.data ?? [];
  const hit = rows.find((r) => String(r?.token ?? r?.symbol ?? "").toUpperCase().includes(sym.toUpperCase()));
  if (!hit) return null;
  const sentiment = Number(hit?.sentiment ?? hit?.change ?? 0);
  const score = clamp(Math.tanh(sentiment));
  return { source: "elfa", score, weight: WEIGHT, live: true, note: `Elfa sentiment for ${sym}`, raw: hit };
}
