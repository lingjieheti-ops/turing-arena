import type { Address } from "viem";

export interface Deployment {
  chainId: number;
  identityRegistry: Address;
  reputationRegistry: Address;
  priceOracle: Address;
  proofOfAlpha: Address;
  operator?: Address;
  /// Optional Mantle DeFi layer (Merchant Moe): real-trade copy-trading + DEX oracle.
  championVault?: Address;
  mantleDexOracle?: Address;
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

type Env = Record<string, string | undefined>;

function pick(env: Env, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = env[k];
    if (v && v.length > 0) return v;
  }
  return undefined;
}

/// Resolve deployed addresses from env. Reads both server (FOO_ADDRESS) and
/// browser (NEXT_PUBLIC_FOO_ADDRESS) variants so the same helper works in the
/// agent runtime and the Next.js client.
export function getAddresses(env: Env = process.env as Env): Deployment {
  return {
    chainId: Number(pick(env, "CHAIN_ID", "NEXT_PUBLIC_CHAIN_ID") ?? "5003"),
    identityRegistry: (pick(env, "IDENTITY_REGISTRY_ADDRESS", "NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS") ??
      ZERO_ADDRESS) as Address,
    reputationRegistry: (pick(env, "REPUTATION_REGISTRY_ADDRESS", "NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS") ??
      ZERO_ADDRESS) as Address,
    priceOracle: (pick(env, "PRICE_ORACLE_ADDRESS", "NEXT_PUBLIC_PRICE_ORACLE_ADDRESS") ??
      ZERO_ADDRESS) as Address,
    proofOfAlpha: (pick(env, "PROOF_OF_ALPHA_ADDRESS", "NEXT_PUBLIC_PROOF_OF_ALPHA_ADDRESS") ??
      ZERO_ADDRESS) as Address,
    operator: pick(env, "OPERATOR_ADDRESS", "NEXT_PUBLIC_OPERATOR_ADDRESS") as Address | undefined,
    championVault: pick(env, "CHAMPION_VAULT_ADDRESS", "NEXT_PUBLIC_CHAMPION_VAULT_ADDRESS") as
      | Address
      | undefined,
    mantleDexOracle: pick(env, "MANTLE_DEX_ORACLE_ADDRESS", "NEXT_PUBLIC_MANTLE_DEX_ORACLE_ADDRESS") as
      | Address
      | undefined,
  };
}

export function isConfigured(d: Deployment): boolean {
  return d.proofOfAlpha !== ZERO_ADDRESS && d.identityRegistry !== ZERO_ADDRESS;
}
