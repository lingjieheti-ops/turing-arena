import { createPublicClient, fallback, http } from "viem";
import { rpcUrls, targetChain } from "./contracts";

/// Read-only client for the leaderboard + rounds (no wallet needed). Falls back
/// across endpoints so a rate-limited RPC doesn't blank the board.
export const publicClient = createPublicClient({
  chain: targetChain,
  transport: fallback(rpcUrls.map((u) => http(u))),
});
