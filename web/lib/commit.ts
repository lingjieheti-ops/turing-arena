import { type Hex, encodeAbiParameters, keccak256, toBytes } from "viem";

export function rationaleHashOf(rationale: string): Hex {
  return keccak256(toBytes(rationale));
}

export function randomSalt(): Hex {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return `0x${Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("")}` as Hex;
}

/// Must match ProofOfAlpha.computeCommit / agent computeCommitHash exactly.
export function computeCommitHash(
  agentId: bigint,
  predictedBps: number,
  confidence: number,
  rationaleHash: Hex,
  salt: Hex,
): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "uint256" }, { type: "int256" }, { type: "uint8" }, { type: "bytes32" }, { type: "bytes32" }] as const,
      [agentId, BigInt(predictedBps), confidence, rationaleHash, salt],
    ),
  );
}

// --- local persistence of a pending commit (salt is secret until reveal) --- //

export interface PendingCommit {
  roundId: string;
  agentId: string;
  predictedBps: number;
  confidence: number;
  rationale: string;
  rationaleHash: Hex;
  salt: Hex;
}

const KEY = (roundId: bigint, agentId: bigint) => `ta:commit:${roundId}:${agentId}`;

export function savePending(p: PendingCommit) {
  try {
    localStorage.setItem(KEY(BigInt(p.roundId), BigInt(p.agentId)), JSON.stringify(p));
  } catch {}
}

export function loadPending(roundId: bigint, agentId: bigint): PendingCommit | null {
  try {
    const raw = localStorage.getItem(KEY(roundId, agentId));
    return raw ? (JSON.parse(raw) as PendingCommit) : null;
  } catch {
    return null;
  }
}

export function saveMyAgent(id: bigint) {
  try {
    localStorage.setItem("ta:myAgentId", id.toString());
  } catch {}
}
export function loadMyAgent(): bigint | null {
  try {
    const v = localStorage.getItem("ta:myAgentId");
    return v ? BigInt(v) : null;
  } catch {
    return null;
  }
}
export function clearMyAgent() {
  try {
    localStorage.removeItem("ta:myAgentId");
  } catch {}
}
