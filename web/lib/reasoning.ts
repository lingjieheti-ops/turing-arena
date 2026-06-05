import { type Hex, keccak256, toBytes } from "viem";
import { decodeAgentCard } from "./agentCard";
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

interface RoundHead {
  title: string;
  entryPrice: bigint;
  settlePrice: bigint;
  settled: boolean;
  topAgentId: bigint;
  topScore: bigint;
}

async function fetchHead(id: bigint): Promise<{ id: bigint; head: RoundHead } | null> {
  try {
    const head = (await withRetry(
      () => publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getRound", args: [id] }),
      2,
    )) as RoundHead;
    return { id, head };
  } catch {
    return null;
  }
}

async function fetchEntries(id: bigint, head: RoundHead, agentIds: bigint[]): Promise<ResultRound> {
  const entryPrice = head.entryPrice ?? 0n;
  const settlePrice = head.settlePrice ?? 0n;
  const actualBps = entryPrice > 0n ? Number(((settlePrice - entryPrice) * 10000n) / entryPrice) : 0;

  // Read each agent's entry in small chunks (the flaky RPC is handled by
  // withRetry, but a wide burst across a dozen+ agents still chokes it, so we
  // cap peak in-flight reads rather than firing all entries at once).
  const raw: ({ aid: bigint; e: RawEntry } | null)[] = [];
  const CHUNK = 5;
  for (let i = 0; i < agentIds.length; i += CHUNK) {
    raw.push(
      ...(await Promise.all(
        agentIds.slice(i, i + CHUNK).map((aid) =>
          withRetry(
            () => publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getEntry", args: [id, aid] }),
            2,
          )
            .then((e) => ({ aid, e: e as RawEntry }))
            .catch(() => null),
        ),
      )),
    );
  }
  const entries: ReasonEntry[] = raw
    .filter((x): x is { aid: bigint; e: RawEntry } => x !== null && x.e.revealed)
    .map(({ aid, e }) => ({
      agentId: aid,
      predictedBps: Number(e.predictedBps),
      confidence: Number(e.confidence),
      rationaleHash: e.rationaleHash,
      scored: e.scored,
      score: e.score,
    }))
    .sort((a, b) => (b.score > a.score ? 1 : b.score < a.score ? -1 : 0));

  return { id, title: head.title, entryPrice, settlePrice, actualBps, topAgentId: head.topAgentId, topScore: head.topScore, entries };
}

/// The last `limit` settled rounds, each with every agent's revealed call + score.
/// Two bounded parallel passes (scan heads, then entries) so it paints fast.
export async function getResultsFeed(limit = 3): Promise<ResultRound[]> {
  const count = (await withRetry(() =>
    publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "roundCount" }),
  )) as bigint;
  const n = await getTotalAgents();
  const agentIds = Array.from({ length: n }, (_, i) => BigInt(i + 1));

  const floor = count > 7n ? count - 7n : 1n;
  const ids: bigint[] = [];
  for (let id = count; id >= floor; id--) ids.push(id);

  // Pass 1: find the settled rounds (one bounded parallel batch of head reads).
  const headResults = await Promise.all(ids.map(fetchHead));
  // A total wipeout means the RPC choked, not that there are no rounds; throw so
  // the caller keeps its last-good data and retries instead of flashing "empty".
  if (headResults.every((h) => h === null)) throw new Error("head reads all failed");
  const chosen = headResults
    .filter((x): x is { id: bigint; head: RoundHead } => x !== null && x.head.settled)
    .slice(0, limit);

  // Pass 2: pull entries ONE ROUND AT A TIME (agents parallel within a round).
  // The public RPC chokes on a wide concurrent burst, so we keep peak in-flight
  // low rather than firing every round's reads at once.
  const rounds: ResultRound[] = [];
  for (const { id, head } of chosen) {
    const rr = await fetchEntries(id, head, agentIds);
    if (rr.entries.length > 0) rounds.push(rr);
  }
  return rounds;
}

export interface Stance {
  bps: number;
  conf: number;
}

/// Each agent's most recent sealed call (direction + conviction) from the latest
/// settled round — the "current mood" shown in the hover card. Best-effort and
/// light (one round's entries); returns an empty map on any RPC hiccup.
export async function getLatestStances(): Promise<Map<string, Stance>> {
  const m = new Map<string, Stance>();
  try {
    const count = (await withRetry(() =>
      publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "roundCount" }),
    )) as bigint;
    if (count === 0n) return m;
    const n = await getTotalAgents();
    const agentIds = Array.from({ length: n }, (_, i) => BigInt(i + 1));

    // Most recent settled round.
    const floor = count > 6n ? count - 6n : 1n;
    let round: { id: bigint; head: RoundHead } | null = null;
    for (let id = count; id >= floor; id--) {
      const r = await fetchHead(id);
      if (r?.head.settled) {
        round = r;
        break;
      }
    }
    if (!round) return m;

    const CHUNK = 5;
    for (let i = 0; i < agentIds.length; i += CHUNK) {
      const batch = await Promise.all(
        agentIds.slice(i, i + CHUNK).map((aid) =>
          withRetry(
            () => publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getEntry", args: [round!.id, aid] }),
            2,
          )
            .then((e) => ({ aid, e: e as RawEntry }))
            .catch(() => null),
        ),
      );
      for (const x of batch) {
        if (x?.e.revealed) m.set(x.aid.toString(), { bps: Number(x.e.predictedBps), conf: Number(x.e.confidence) });
      }
    }
  } catch {
    /* mood is best-effort */
  }
  return m;
}

export interface AgentMeta {
  name: string;
  kind: "AI" | "HUMAN";
  model?: string;
  avatar?: string;
  blurb?: string;
}

/// Lightweight name/kind/model for a handful of agents — one agentURI read each
/// (the card), far cheaper than the full leaderboard. Keyed by agentId string.
export async function getAgentMeta(agentIds: bigint[]): Promise<Map<string, AgentMeta>> {
  const m = new Map<string, AgentMeta>();
  await Promise.all(
    agentIds.map(async (id) => {
      try {
        const uri = (await withRetry(
          () => publicClient.readContract({ address: ID, abi: identityRegistryAbi, functionName: "agentURI", args: [id] }),
          5,
        )) as string;
        const card = decodeAgentCard(uri);
        m.set(id.toString(), {
          name: card.name || `Agent #${id}`,
          kind: card.kind === "HUMAN" ? "HUMAN" : "AI",
          model: card.model,
          avatar: card.avatar,
          blurb: card.persona ?? card.description,
        });
      } catch {
        /* skip an agent we couldn't read */
      }
    }),
  );
  return m;
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
