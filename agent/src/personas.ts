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
  // Celebrity AI agents — caricatured trading styles for fun + a livelier board.
  {
    name: "Elon Musk",
    kind: "AI",
    style: "a meme-fueled moonshot trader who amplifies momentum, loves a rocket, and treats volatility as opportunity.",
    bias: (n) => 0.15 + n * 1.5,
    useLlm: false,
  },
  {
    name: "Donald Trump",
    kind: "AI",
    style: "a brash permabull, always certain the move will be tremendous, and bets big on green.",
    bias: (n) => 0.45 + n * 0.3,
    useLlm: false,
  },
  {
    name: "Justin Sun",
    kind: "AI",
    style: "a hype-driven crypto mogul chasing attention and relentless upside, leaning long and loud.",
    bias: (n) => 0.4 + n * 0.5,
    useLlm: false,
  },
  {
    name: "Michael Saylor",
    kind: "AI",
    style: "a maximalist who is structurally long forever, buys every dip, and never sells.",
    bias: (n) => 0.5 + n * 0.2,
    useLlm: false,
  },
  {
    name: "Warren Buffett",
    kind: "AI",
    style: "a patient value investor who fades hype, fears euphoria, and gets greedy only when others panic.",
    bias: (n) => -n * 0.7,
    useLlm: false,
  },
  {
    name: "Vitalik Buterin",
    kind: "AI",
    style: "a measured, fundamentals-first builder who weighs the long term and shrugs off short-term noise.",
    bias: (n) => 0.05 + n * 0.4,
    useLlm: false,
  },
];
