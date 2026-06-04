import { ATHENA, type Persona } from "./brain";

/// The Human-vs-AI cast used by the keyless demo (and selectable for live runs).
/// Athena fuses everything; the others are caricatured styles so the leaderboard
/// tells a story. The human (Hank) trades on gut + a structural long bias.
export const CAST: Persona[] = [
  { ...ATHENA, name: "Athena", kind: "AI" },
  {
    name: "Allora Scout",
    kind: "AI",
    style: "trades purely on Allora Network's decentralized ML inference — the crowd-AI forecast.",
    only: ["allora"],
    useLlm: false,
  },
  {
    name: "Momentum Max",
    kind: "AI",
    style: "a trend-follower that leans hard into wherever the signals point.",
    bias: (n) => n * 1.7,
    useLlm: false,
  },
  {
    name: "Contrarian Cora",
    kind: "AI",
    style: "a mean-reversion contrarian who fades the crowd.",
    bias: (n) => -n * 1.1,
    useLlm: false,
  },
  {
    name: "HODLer Hank",
    kind: "HUMAN",
    style: "a retail human who is structurally long and trades on gut feel.",
    bias: (n) => 0.35 + n * 0.25,
    useLlm: false,
  },
];
