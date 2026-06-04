import { assetBySymbol } from "@turing-arena/shared";
import { fetchJson } from "./signals/util";

/// Real spot price (USD) for settlement, so testnet rounds resolve against an
/// actual market move. Keyless (CoinGecko public). Returns null on failure; the
/// caller decides on a fallback.
export async function spotPrice(symbol: string): Promise<number | null> {
  const meta = assetBySymbol(symbol);
  if (!meta?.coingeckoId) return null;
  const data = await fetchJson<any>(
    `https://api.coingecko.com/api/v3/simple/price?ids=${meta.coingeckoId}&vs_currencies=usd`,
  );
  const v = Number(data?.[meta.coingeckoId]?.usd);
  return Number.isFinite(v) && v > 0 ? v : null;
}
