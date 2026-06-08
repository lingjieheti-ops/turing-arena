import { type Address, type Hex, keccak256, toBytes } from "viem";

/// Canonical asset id used by ProofOfAlpha == keccak256(utf8 bytes of the symbol).
/// Matches Solidity `keccak256(bytes("METH/USD"))`.
export function assetId(symbol: string): Hex {
  return keccak256(toBytes(symbol));
}

export interface AssetMeta {
  symbol: string; // arena symbol, e.g. "METH/USD"
  label: string; // UI label
  /// Mantle MAINNET token address (informational / on-chain signal reader).
  token?: Address;
  coingeckoId?: string;
}

/// Assets the arena benchmarks. mETH + USDY are Mantle's flagship RWA / LST.
export const ASSETS: AssetMeta[] = [
  {
    symbol: "METH/USD",
    label: "mETH / USD",
    token: "0xcDA86A272531e8640cD7F1a92c01839911B90bb0", // Mantle mainnet mETH
    coingeckoId: "mantle-staked-ether",
  },
  {
    symbol: "ETH/USD",
    label: "ETH / USD",
    coingeckoId: "ethereum",
  },
  {
    symbol: "MNT/USD",
    label: "MNT / USD",
    coingeckoId: "mantle",
  },
  // The arena rotates across these liquid markets each round (keeper rotation),
  // so the benchmark isn't a monotone ETH bet.
  {
    symbol: "BTC/USD",
    label: "BTC / USD",
    coingeckoId: "bitcoin",
  },
  {
    symbol: "SOL/USD",
    label: "SOL / USD",
    coingeckoId: "solana",
  },
  {
    symbol: "USDY/USD",
    label: "USDY / USD",
    token: "0x5bE26527e817998A7206475496fDE1E68957c5A6", // Mantle mainnet USDY (Ondo)
    coingeckoId: "ondo-us-dollar-yield",
  },
];

export function assetBySymbol(symbol: string): AssetMeta | undefined {
  return ASSETS.find((a) => a.symbol === symbol);
}
