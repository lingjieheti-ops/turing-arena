/// Shared domain types for the agent + web app.

export type Direction = "UP" | "DOWN" | "FLAT";

/// A single signal source's read, normalized to a bounded score in [-1, 1]
/// (negative = bearish, positive = bullish) plus a human-readable note.
export interface Signal {
  source: string; // "allora" | "nansen" | "elfa" | "surf" | "mantle-onchain"
  score: number; // [-1, 1]
  weight: number; // relative importance used in fusion
  note: string; // one-line human explanation (shown in the UI)
  raw?: unknown; // optional provenance payload
  live: boolean; // true if from a real API, false if mock fallback
}

export interface SignalBundle {
  asset: string;
  signals: Signal[];
  fetchedAt: number;
}

/// The agent's (or human's) prediction for a round.
export interface Decision {
  direction: Direction;
  predictedBps: number; // signed basis-point point forecast
  confidence: number; // 1..100 conviction / bet size
  rationale: string; // natural-language explanation (hashed on-chain)
  signals: Signal[]; // the evidence behind the call
  model: string; // which brain produced it ("heuristic" | model name)
}

export interface RoundView {
  roundId: bigint;
  asset: string; // symbol
  title: string;
  oracle: `0x${string}`;
  commitDeadline: bigint;
  revealDeadline: bigint;
  settleTime: bigint;
  settled: boolean;
  entryPrice: bigint;
  settlePrice: bigint;
  stake: bigint;
  prizePool: bigint;
  topAgentId: bigint;
  topScore: bigint;
  revealCount: number;
  participantCount: number;
}

export interface AgentStats {
  agentId: bigint;
  score: bigint;
  played: number;
  correct: number;
  accuracyBps: number;
}

export interface AgentCard {
  name: string;
  description: string;
  kind: "AI" | "HUMAN";
  model?: string;
  signals?: string[];
  // ERC-8004 / A2A style "agent card" surface.
  endpoints?: { name: string; url?: string }[];
}
