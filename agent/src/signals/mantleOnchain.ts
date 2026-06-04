import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPublicClient, erc20Abi, http } from "viem";
import { type Signal, assetBySymbol, mantle } from "@turing-arena/shared";
import { cfg } from "../config";
import { clamp, hourBucket, mockScore } from "./util";

const WEIGHT = 0.2; // Mantle on-chain data — REQUIRED core source for the track

// Read-only Mantle mainnet client (no key needed) for genuine on-chain reads.
const client = createPublicClient({ chain: mantle, transport: http() });

/// Reads real Mantle on-chain state (e.g. mETH total staked supply) and derives a
/// momentum signal vs the previous observation. This is the load-bearing
/// "Mantle on-chain data as a core source" input. Falls back to a mock if the
/// asset has no on-chain token or the RPC read fails.
export async function mantleOnchainSignal(
  asset: string,
  seed: string | number = hourBucket(),
): Promise<Signal> {
  const meta = assetBySymbol(asset);
  if (meta?.token) {
    try {
      const supply = await client.readContract({
        address: meta.token,
        abi: erc20Abi,
        functionName: "totalSupply",
      });
      const score = supplyMomentum(asset, supply);
      return {
        source: "mantle-onchain",
        score,
        weight: WEIGHT,
        live: true,
        note: `Mantle on-chain: ${meta.symbol} staked supply momentum`,
        raw: { totalSupply: supply.toString() },
      };
    } catch {
      // fall through to mock
    }
  }
  const score = mockScore("mantle-onchain", asset, seed);
  return {
    source: "mantle-onchain",
    score,
    weight: WEIGHT,
    live: false,
    note: `Mantle on-chain momentum ${score >= 0 ? "up" : "down"}`,
  };
}

function supplyMomentum(asset: string, supply: bigint): number {
  const path = join(cfg.stateDir, "onchain-baseline.json");
  let base: Record<string, string> = {};
  try {
    if (existsSync(path)) base = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    base = {};
  }
  const prev = base[asset] ? BigInt(base[asset]) : 0n;
  base[asset] = supply.toString();
  try {
    mkdirSync(cfg.stateDir, { recursive: true });
    writeFileSync(path, JSON.stringify(base, null, 2));
  } catch {
    /* best-effort */
  }
  if (prev === 0n) return 0; // first observation -> neutral baseline
  const delta = Number(supply - prev) / Number(prev);
  return clamp(Math.tanh(delta * 2000)); // bound tiny supply changes
}
