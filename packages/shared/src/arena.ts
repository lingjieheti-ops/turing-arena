import type { Decision, Signal } from "./types";

/// Mirror of ProofOfAlpha.MAX_ABS_BPS — keeps off-chain scoring identical to
/// on-chain settlement so the UI/agent never disagree with the contract.
export const MAX_ABS_BPS = 2000;

/// TypeScript mirror of ProofOfAlpha._score (integer, truncated toward zero).
export function scoreAlpha(
  predictedBps: number,
  confidence: number,
  actualBps: number,
): { score: number; correct: boolean } {
  let a = Math.trunc(actualBps);
  if (a > MAX_ABS_BPS) a = MAX_ABS_BPS;
  if (a < -MAX_ABS_BPS) a = -MAX_ABS_BPS;
  const dir = predictedBps > 0 ? 1 : predictedBps < 0 ? -1 : 0;
  const score = Math.trunc((dir * a * confidence) / 100);
  const correct = dir !== 0 && a !== 0 && dir > 0 === a > 0;
  return { score, correct };
}

/// Weighted fusion of normalized signals -> a point forecast (bps) + conviction.
/// Used by the heuristic brain and as a sanity floor under the LLM brain.
export function fuseSignals(signals: Signal[]): { predictedBps: number; confidence: number; net: number } {
  if (signals.length === 0) return { predictedBps: 0, confidence: 1, net: 0 };
  let wsum = 0;
  let acc = 0;
  for (const s of signals) {
    const w = Math.max(0, s.weight);
    acc += clamp(s.score, -1, 1) * w;
    wsum += w;
  }
  const net = wsum === 0 ? 0 : acc / wsum; // [-1, 1]
  // Map net conviction to a bounded point forecast (max ~6% expected move) and
  // a confidence in [1,100] that grows with |net| and signal agreement.
  const predictedBps = Math.round(net * 600);
  const agreement = signalAgreement(signals);
  const confidence = clampInt(Math.round((0.35 + 0.65 * Math.abs(net)) * agreement * 100), 1, 100);
  return { predictedBps, confidence, net };
}

function signalAgreement(signals: Signal[]): number {
  // fraction in [0.5,1]: how aligned the signals are in sign.
  const dirs = signals.map((s) => Math.sign(s.score)).filter((d) => d !== 0);
  if (dirs.length === 0) return 0.5;
  const up = dirs.filter((d) => d > 0).length;
  const frac = Math.max(up, dirs.length - up) / dirs.length;
  return 0.5 + 0.5 * frac;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
export function clampInt(x: number, lo: number, hi: number): number {
  return Math.round(clamp(x, lo, hi));
}

/// Convert a Decision to the on-chain direction label.
export function decisionDirection(d: Pick<Decision, "predictedBps">): "UP" | "DOWN" | "FLAT" {
  if (d.predictedBps > 0) return "UP";
  if (d.predictedBps < 0) return "DOWN";
  return "FLAT";
}
