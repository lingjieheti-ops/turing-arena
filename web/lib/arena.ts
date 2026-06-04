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
  owner: Address;
  score: bigint;
  played: number;
  correct: number;
  accuracyBps: number;
  repCount: number;
}

const SYMBOL_BY_ID = new Map(ASSETS.map((a) => [assetId(a.symbol).toLowerCase(), a.symbol] as const));

export function symbolFromAssetId(id: Hex): string {
  return SYMBOL_BY_ID.get(id.toLowerCase() as Hex) ?? `${id.slice(0, 10)}…`;
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

export async function getRoundCount(): Promise<bigint> {
  return publicClient.readContract({
    address: POA,
    abi: proofOfAlphaAbi,
    functionName: "roundCount",
  }) as Promise<bigint>;
}

async function readRound(id: bigint): Promise<RoundUI> {
  const [r, pc] = await Promise.all([
    publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "getRound", args: [id] }) as Promise<any>,
    publicClient.readContract({ address: POA, abi: proofOfAlphaAbi, functionName: "participantCount", args: [id] }) as Promise<bigint>,
  ]);
  return {
    id,
    asset: symbolFromAssetId(r.asset),
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
  return Promise.all(ids.map(readRound));
}

export async function getActiveRound(): Promise<RoundUI | null> {
  const rounds = await getRecentRounds(8);
  return rounds.find((r) => r.phase !== "settled") ?? rounds[0] ?? null;
}

export async function getLeaderboard(limit = 50): Promise<AgentUI[]> {
  const total = (await publicClient.readContract({
    address: ID,
    abi: identityRegistryAbi,
    functionName: "totalAgents",
  })) as bigint;
  const n = Math.min(Number(total), limit);
  const ids = Array.from({ length: n }, (_, i) => BigInt(i + 1));
  const agents = await Promise.all(ids.map(readAgent));
  return (agents.filter(Boolean) as AgentUI[]).sort((a, b) =>
    b.score > a.score ? 1 : b.score < a.score ? -1 : 0,
  );
}

async function readAgent(agentId: bigint): Promise<AgentUI | null> {
  try {
    const [stats, owner, uri, summary] = await Promise.all([
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
    ]);
    const card = decodeAgentCard(uri);
    return {
      agentId,
      name: card.name || `Agent #${agentId}`,
      kind: card.kind === "HUMAN" ? "HUMAN" : "AI",
      model: card.model,
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
