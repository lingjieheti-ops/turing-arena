import type { Direction } from "./types";

/// Oracle prices are 1e8-scaled (Chainlink-style), matching IPriceOracle.decimals().
export const ORACLE_DECIMALS = 8;
export const ORACLE_SCALE = 100_000_000n; // 1e8

export function fromOraclePrice(p: bigint): number {
  return Number(p) / Number(ORACLE_SCALE);
}

export function toOraclePrice(n: number): bigint {
  return BigInt(Math.round(n * Number(ORACLE_SCALE)));
}

export function bpsToPct(bps: bigint | number): number {
  return Number(bps) / 100;
}

export function directionFromBps(bps: bigint | number): Direction {
  const n = Number(bps);
  if (n > 0) return "UP";
  if (n < 0) return "DOWN";
  return "FLAT";
}

export function shortAddr(a?: string): string {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}
