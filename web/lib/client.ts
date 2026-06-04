import { createPublicClient, http } from "viem";
import { rpcUrl, targetChain } from "./contracts";

/// Read-only client for the leaderboard + rounds (no wallet needed).
export const publicClient = createPublicClient({
  chain: targetChain,
  transport: http(rpcUrl),
});
