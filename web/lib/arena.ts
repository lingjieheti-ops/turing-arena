import type { Address, Hex } from "viem";
import { ASSETS, assetId } from "@turing-arena/shared";
import { decodeAgentCard } from "./agentCard";
import { publicClient } from "./client";
import { deployment, identityRegistryAbi, proofOfAlphaAbi, reputationRegistryAbi } from "./contracts";

const POA = deployment.proofOfAlpha;
const ID = deployment.identityRegistry;
const REP = deployment.reputationRegistry;

export type Phase = "commit" | "reveal" | "settle" | "settled";

export interface RoundUI {
  id: bigint;
  asset: string;
  title: string;
  phase: Phase;
  entryPrice: bigint;
  settlePrice: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  settleTime: bigint;
  participantCount: number;
  revealCount: number;
  topAgentId: bigint;
  topScore: bigint;
  settled: boolean;
}

export interface AgentUI {
  agentId: bigint;
  name: string;
  kind: "AI" | "HUMAN";
  model?: string;
  avatar?: string;
  owner: Address;
  score: bigint;
  played: number;
  correct: number;
  accuracyBps: number;
  repCount: number;
}

const SYMBOL_BY_ID = new Map(ASSETS.map((a) => [assetId(a.symbol).toLowerCase(), a.symbol] as const));

/// Map a keccak asset id to a clean symbol. For an unknown id (e.g. an asset the
/// shared ASSETS list doesn't cover) prefer the round's own human title over a
/// meaningless hash slice, so the UI never shows "0x1c8aef93…" as the asset.
export function symbolFromAssetId(id: Hex, title?: string): string {
  const known = SYMBOL_BY_ID.get(id.toLowerCase() as Hex);
  if (known) return known;
  const clean = title?.trim();
  if (clean) return clean;
  return `${id.slice(0, 10)}…`;
}

export function phaseOf(
  r: { commitDeadline: bigint; revealDeadline: bigint; settleTime: bigint; settled: boolean },
  nowSec = Math.floor(Date.now() / 1000),
): Phase {
  if (r.settled) return "settled";
  const n = BigInt(nowSec);
  if (n <= r.commitDeadline) return "commit";
  if (n <= r.revealDeadline) return "reveal";
  return "settle";
}

/// Retry a flaky read a few times — the public Mantle Sepolia RPC drops requests
/// under load, and a single drop must not blank the whole arena.
export async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 220 * (i + 1)));
    }
  }
  throw last;
}

export async function getRoundCount(): Promise<bigint> {
  return withRetry(
    () =>
      publicClient.readContract({
        address: POA,
        abi: proofOfAlphaAbi,
        functionName: "roundCount",
      }) as Promise<bigint>,
  );
}

async function readRound(id: bigint): Promise<RoundUI> {
  // getRound is essential (retry it); participantCount is best-effort (default 0).
  const r = (await withRetry(
    () => publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getRound", args: [id] }) as Promise<any>,
  )) as any;
  let pc = 0n;
  try {
    // Best-effort, but retried: a single dropped read must not flicker the
    // player count to 0 while a round genuinely has participants.
    pc = (await withRetry(
      () =>
        publicClient.readContract({
          address: POA,
          abi: proofOfAlphaAbi,
          functionName: "participantCount",
          args: [id],
        }) as Promise<bigint>,
      3,
    )) as bigint;
  } catch {
    /* tolerate */
  }
  return {
    id,
    asset: symbolFromAssetId(r.asset, r.title),
    title: r.title,
    phase: phaseOf(r),
    entryPrice: r.entryPrice,
    settlePrice: r.settlePrice,
    commitDeadline: r.commitDeadline,
    revealDeadline: r.revealDeadline,
    settleTime: r.settleTime,
    participantCount: Number(pc),
    revealCount: Number(r.revealCount),
    topAgentId: r.topAgentId,
    topScore: r.topScore,
    settled: r.settled,
  };
}

export async function getRecentRounds(limit = 6): Promise<RoundUI[]> {
  const count = await getRoundCount();
  const ids: bigint[] = [];
  for (let id = count; id >= 1n && ids.length < limit; id--) ids.push(id);
  // allSettled: a single dropped RPC read for one round must not blank the rest.
  const results = await Promise.allSettled(ids.map(readRound));
  const ok = results
    .filter((s): s is PromiseFulfilledResult<RoundUI> => s.status === "fulfilled")
    .map((s) => s.value);
  // Rounds exist on-chain but every read dropped: that's an RPC choke, not an
  // empty arena. Throw so callers keep last-good data instead of flashing empty.
  if (count > 0n && ids.length > 0 && ok.length === 0) throw new Error("all round reads failed");
  return ok;
}

export async function getActiveRound(): Promise<RoundUI | null> {
  const rounds = await getRecentRounds(8);
  // Only surface a round that's still open (commit / reveal / awaiting settle).
  // A fully-settled round must NOT be returned — the UI shows its "No live round"
  // empty state instead of a stale, un-playable board.
  const open = rounds.find((r) => r.phase !== "settled");
  return open ?? null;
}

export async function getLeaderboard(limit = 50): Promise<AgentUI[]> {
  const total = (await withRetry(() =>
    publicClient.readContract({
      address: ID,
      abi: identityRegistryAbi,
      functionName: "totalAgents",
    }),
  )) as bigint;
  const n = Math.min(Number(total), limit);
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  // Read in small chunks: with a dozen+ agents, firing every agent's 4-read
  // batch at once (e.g. 13 x 4 = 52 concurrent) chokes the flaky public RPC and
  // silently drops agents from the board. Keep peak in-flight low instead.
  const agents: (AgentUI | null)[] = [];
  const CHUNK = 4;
  for (let i = 0; i < ids.length; i += CHUNK) {
    agents.push(...(await Promise.all(ids.slice(i, i + CHUNK).map(readAgent))));
  }
  // Sort by score, then by agentId so tied (e.g. brand-new, 0-score) agents hold
  // a stable order across refreshes instead of reshuffling every poll.
  return (agents.filter(Boolean) as AgentUI[]).sort((a, b) =>
    b.score > a.score ? 1 : b.score < a.score ? -1 : Number(a.agentId - b.agentId),
  );
}

async function readAgent(agentId: bigint): Promise<AgentUI | null> {
  try {
    // Retry the whole 4-read batch: the flaky public RPC must not null out a
    // real agent (which would drop the live leaderboard back to sample data).
    const [stats, owner, uri, summary] = await withRetry(() =>
      Promise.all([
        publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getAgentStats", args: [agentId] }) as Promise<
          readonly [bigint, number, number, number]
        >,
        publicClient.readContract({ address: ID, abi: identityRegistryAbi, functionName: "ownerOf", args: [agentId] }) as Promise<Address>,
        publicClient.readContract({ address: ID, abi: identityRegistryAbi, functionName: "agentURI", args: [agentId] }) as Promise<string>,
        publicClient.readContract({
          address: REP,
          abi: reputationRegistryAbi,
          functionName: "getSummary",
          args: [agentId, [], "proof-of-alpha", ""],
        }) as Promise<readonly [bigint, bigint, number]>,
      ]),
    );
    const card = decodeAgentCard(uri);
    return {
      agentId,
      name: card.name || `Agent #${agentId}`,
      kind: card.kind === "HUMAN" ? "HUMAN" : "AI",
      model: card.model,
      avatar: card.avatar,
      owner,
      score: stats[0],
      played: Number(stats[1]),
      correct: Number(stats[2]),
      accuracyBps: Number(stats[3]),
      repCount: Number(summary[0]),
    };
  } catch {
    return null;
  }
}
