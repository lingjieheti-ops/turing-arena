import type { Signal } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, fetchJson, hourBucket, mockScore } from "./util";

const WEIGHT = 0.3; // Allora = decentralized ML inference (judge org) -> top weight

/// Allora Network signal: the "crowd-AI" price forecast. Real call is best-effort
/// against the consumer inference API; falls back to a deterministic mock.
export async function alloraSignal(asset: string, seed: string | number = hourBucket()): Promise<Signal> {
  if (cfg.signals.allora.key) {
    const live = await tryLive();
    if (live) return live;
  }
  const score = mockScore("allora", asset, seed);
  return {
    source: "allora",
    score,
    weight: WEIGHT,
    live: false,
    note: `Allora ML forecast ${score >= 0 ? "leans long" : "leans short"}`,
  };
}

async function tryLive(): Promise<Signal | null> {
  const { base, key, topicId } = cfg.signals.allora;
  const data = await fetchJson<any>(`${base}/v2/allora/consumer/inferences/${topicId}`, {
    headers: { "x-api-key": key, accept: "application/json" },
  });
  const ni = Number(data?.network_inference ?? data?.combined_value ?? data?.data?.network_inference);
  if (!Number.isFinite(ni)) return null;
  const score = clamp(Math.tanh(((ni % 1) - 0.5) * 4));
  return {
    source: "allora",
    score,
    weight: WEIGHT,
    live: true,
    note: `Allora topic ${topicId} network inference`,
    raw: data,
  };
}
