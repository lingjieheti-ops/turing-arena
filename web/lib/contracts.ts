import type { Address } from "viem";
import {
  type Deployment,
  ZERO_ADDRESS,
  chainById,
  championVaultAbi,
  identityRegistryAbi,
  proofOfAlphaAbi,
  reporterPriceOracleAbi,
  reputationRegistryAbi,
} from "@turing-arena/shared";

// IMPORTANT: reference each NEXT_PUBLIC_* var STATICALLY so Next.js inlines it
// into the browser bundle. Dynamic access (env[key]) is NOT inlined client-side.
export const deployment: Deployment = {
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5003"),
  identityRegistry: (process.env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS ?? ZERO_ADDRESS) as Address,
  reputationRegistry: (process.env.NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS ?? ZERO_ADDRESS) as Address,
  priceOracle: (process.env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS ?? ZERO_ADDRESS) as Address,
  proofOfAlpha: (process.env.NEXT_PUBLIC_PROOF_OF_ALPHA_ADDRESS ?? ZERO_ADDRESS) as Address,
  championVault: (process.env.NEXT_PUBLIC_CHAMPION_VAULT_ADDRESS || undefined) as Address | undefined,
};

export const targetChain = chainById(deployment.chainId);

// Frontend read endpoints. On Mantle Sepolia we prefer the less-busy
// alternatives and keep the official public RPC LAST, so the dApp's polling
// doesn't compete with the user's own wallet (which usually sits on the
// official endpoint) — that contention is what rate-limits deploy txs.
export const rpcUrls: string[] =
  deployment.chainId === 5003
    ? [
        ...(process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL ? [process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL] : []),
        "https://mantle-sepolia.drpc.org",
        "https://mantle-sepolia.gateway.tenderly.co",
        "https://mantle-sepolia-testnet.rpc.thirdweb.com",
        "https://rpc.sepolia.mantle.xyz",
      ]
    : [...targetChain.rpcUrls.default.http];

export const rpcUrl = rpcUrls[0];

export const explorerUrl = targetChain.blockExplorers?.default.url ?? "";

export { proofOfAlphaAbi, identityRegistryAbi, reputationRegistryAbi, reporterPriceOracleAbi, championVaultAbi };

export function isLive(): boolean {
  return deployment.proofOfAlpha !== ZERO_ADDRESS && deployment.identityRegistry !== ZERO_ADDRESS;
}

export function hasChampionVault(): boolean {
  return Boolean(deployment.championVault) && deployment.championVault !== ZERO_ADDRESS;
}
