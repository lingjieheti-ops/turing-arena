import type { Signal } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, fetchJson, hourBucket, mockScore } from "./util";

const WEIGHT = 0.25; // Nansen smart-money net flows

export async function nansenSignal(asset: string, seed: string | number = hourBucket()): Promise<Signal> {
  if (cfg.signals.nansen.key) {
    const live = await tryLive();
    if (live) return live;
  }
  const score = mockScore("nansen", asset, seed);
  return {
    source: "nansen",
    score,
    weight: WEIGHT,
    live: false,
    note: `Smart money net ${score >= 0 ? "inflow" : "outflow"}`,
  };
}

async function tryLive(): Promise<Signal | null> {
  const { base, key } = cfg.signals.nansen;
  // Smart-money net flows on Mantle (best-effort; response shapes vary).
  const data = await fetchJson<any>(`${base}/smart-money/netflows?chain=mantle`, {
    headers: { apiKey: key, accept: "application/json" },
  });
  const rows: any[] = Array.isArray(data) ? data : (data?.data ?? []);
  if (!rows.length) return null;
  const net = rows.reduce((acc, r) => acc + Number(r?.netflow ?? r?.net_flow ?? 0), 0);
  if (!Number.isFinite(net) || net === 0) return null;
  const score = clamp(Math.tanh(net / 1_000_000));
  return {
    source: "nansen",
    score,
    weight: WEIGHT,
    live: true,
    note: `Nansen smart-money net flow ${net >= 0 ? "+" : ""}${Math.round(net)}`,
    raw: data,
  };
}
