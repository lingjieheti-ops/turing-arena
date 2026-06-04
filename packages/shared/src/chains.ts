import { type Chain, defineChain } from "viem";

/// Mantle Sepolia testnet (chainId 5003). Native gas token is MNT.
export const mantleSepolia = defineChain({
  id: 5003,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  // Multiple endpoints so the dApp (and wallets adding the chain) can fall back
  // when the busy public RPC rate-limits. All verified to serve chain 5003.
  rpcUrls: {
    default: {
      http: [
        "https://rpc.sepolia.mantle.xyz",
        "https://mantle-sepolia.drpc.org",
        "https://mantle-sepolia.gateway.tenderly.co",
        "https://mantle-sepolia-testnet.rpc.thirdweb.com",
      ],
    },
  },
  blockExplorers: {
    default: { name: "Mantle Sepolia Explorer", url: "https://explorer.sepolia.mantle.xyz" },
  },
  testnet: true,
});

/// Mantle mainnet (chainId 5000).
export const mantle = defineChain({
  id: 5000,
  name: "Mantle",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mantle.xyz"] },
  },
  blockExplorers: {
    default: { name: "Mantlescan", url: "https://mantlescan.xyz" },
  },
});

export const CHAINS = { mantleSepolia, mantle } as const;

export function chainById(id: number): Chain {
  if (id === 5003) return mantleSepolia;
  if (id === 5000) return mantle;
  throw new Error(`Unsupported chainId ${id}; expected Mantle 5000/5003`);
}
