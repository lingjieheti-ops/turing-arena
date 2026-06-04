import { type Hex, keccak256, toBytes } from "viem";
import { withRetry } from "./arena";
import { publicClient } from "./client";
import { deployment, identityRegistryAbi, proofOfAlphaAbi } from "./contracts";

/// Where the keeper publishes each sealed rationale (committed to the repo). The
/// on-chain `rationaleHash` lets the browser VERIFY this exact text was the one
/// sealed at commit time — it can't have been edited to fit the outcome.
const REVEALS_BASE =
  "https://raw.githubusercontent.com/lingjieheti-ops/turing-arena/main/keeper-state/reveals";

const POA = deployment.proofOfAlpha;
const ID = deployment.identityRegistry;

/// keccak256(utf8(text)) — must match agent/web commit hashing exactly.
export function hashRationale(s: string): Hex {
  return keccak256(toBytes(s));
}

export interface ReasonEntry {
  agentId: bigint;
  predictedBps: number;
  confidence: number;
  rationaleHash: Hex;
  scored: boolean;
  score: bigint;
}

export interface ResultRound {
  id: bigint;
  title: string;
  entryPrice: bigint;
  settlePrice: bigint;
  actualBps: number; // realized move, basis points
  topAgentId: bigint;
  topScore: bigint;
  entries: ReasonEntry[]; // revealed entries, best score first
}

interface RawEntry {
  commitHash: Hex;
  revealed: boolean;
  scored: boolean;
  confidence: number;
  predictedBps: bigint;
  rationaleHash: Hex;
  score: bigint;
}

async function getTotalAgents(): Promise<number> {
  const n = (await withRetry(() =>
    publicClient.readContract({ address: ID, abi: identityRegistryAbi, functionName: "totalAgents" }),
  )) as bigint;
  return Number(n);
}

async function roundResult(id: bigint, agentIds: bigint[]): Promise<ResultRound | null> {
  const r = (await withRetry(() =>
    publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getRound", args: [id] }),
  )) as {
    title: string;
    entryPrice: bigint;
    settlePrice: bigint;
    settled: boolean;
    topAgentId: bigint;
    topScore: bigint;
  };
  if (!r.settled) return null;
  const entryPrice = r.entryPrice ?? 0n;
  const settlePrice = r.settlePrice ?? 0n;
  const actualBps = entryPrice > 0n ? Number(((settlePrice - entryPrice) * 10000n) / entryPrice) : 0;

  const entries: ReasonEntry[] = [];
  for (const aid of agentIds) {
    try {
      const e = (await withRetry(
        () => publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getEntry", args: [id, aid] }),
        2,
      )) as RawEntry;
      if (e.revealed) {
        entries.push({
          agentId: aid,
          predictedBps: Number(e.predictedBps),
          confidence: Number(e.confidence),
          rationaleHash: e.rationaleHash,
          scored: e.scored,
          score: e.score,
        });
      }
    } catch {
      /* tolerate a dropped read for one agent */
    }
  }
  entries.sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0));
  return { id, title: r.title, entryPrice, settlePrice, actualBps, topAgentId: r.topAgentId, topScore: r.topScore, entries };
}

/// The last `limit` settled rounds, each with every agent's revealed call + score.
export async function getResultsFeed(limit = 3): Promise<ResultRound[]> {
  const count = (await withRetry(() =>
    publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "roundCount" }),
  )) as bigint;
  const n = await getTotalAgents();
  const agentIds = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const out: ResultRound[] = [];
  // Walk back from the head, but don't scan forever on a sparse history.
  const floor = count > 12n ? count - 12n : 1n;
  for (let id = count; id >= floor && out.length < limit; id--) {
    try {
      const rr = await roundResult(id, agentIds);
      if (rr && rr.entries.length > 0) out.push(rr);
    } catch {
      /* skip a bad round */
    }
  }
  return out;
}

export interface VerifiedRationale {
  text: string;
  model?: string;
  verified: boolean;
}

/// Fetch the sealed rationale the keeper published for (round, agent) and verify
/// it hashes to the on-chain `rationaleHash`. `verified=true` proves the text is
/// exactly what was committed before the outcome was known.
export async function fetchRationale(
  roundId: bigint,
  agentId: bigint,
  onchainHash: Hex,
): Promise<VerifiedRationale | null> {
  try {
    const res = await fetch(`${REVEALS_BASE}/r${roundId}-a${agentId}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { rationale?: string; model?: string };
    const text = j.rationale ?? "";
    if (!text) return null;
    const verified = hashRationale(text).toLowerCase() === onchainHash.toLowerCase();
    return { text, model: j.model, verified };
  } catch {
    return null;
  }
}
