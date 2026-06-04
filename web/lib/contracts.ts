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

export const rpcUrl =
  process.env.NEXT_PUBLIC_MANTLE_SEPOLIA_RPC_URL || targetChain.rpcUrls.default.http[0];

export const explorerUrl = targetChain.blockExplorers?.default.url ?? "";

export { proofOfAlphaAbi, identityRegistryAbi, reputationRegistryAbi, reporterPriceOracleAbi, championVaultAbi };

export function isLive(): boolean {
  return deployment.proofOfAlpha !== ZERO_ADDRESS && deployment.identityRegistry !== ZERO_ADDRESS;
}

export function hasChampionVault(): boolean {
  return Boolean(deployment.championVault) && deployment.championVault !== ZERO_ADDRESS;
}
