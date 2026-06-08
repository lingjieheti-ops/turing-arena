import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chainById, getAddresses } from "@turing-arena/shared";

const here = dirname(fileURLToPath(import.meta.url));
// Load repo-root .env first, then an optional agent-local .env (overrides).
loadEnv({ path: resolve(here, "../../.env") });
loadEnv({ path: resolve(here, "../.env") });

const env = process.env;

export const cfg = {
  rpcUrl: env.MANTLE_SEPOLIA_RPC_URL || "https://rpc.sepolia.mantle.xyz",
  privateKey: (env.PRIVATE_KEY || "").trim(),
  addresses: getAddresses(env),
  asset: env.ARENA_ASSET || "METH/USD",
  agentName: env.AGENT_NAME || "Athena",
  agentId: env.AGENT_ID ? BigInt(env.AGENT_ID) : undefined,
  llm: {
    baseUrl: (env.LLM_BASE_URL || "https://api.altllm.ai/v1").replace(/\/$/, ""),
    apiKey: (env.LLM_API_KEY || "").trim(),
    model: env.LLM_MODEL || "gpt-4o-mini",
  },
  signals: {
    allora: {
      key: (env.ALLORA_API_KEY || "").trim(),
      base: (env.ALLORA_BASE_URL || "https://api.allora.network").replace(/\/$/, ""),
      topicId: env.ALLORA_TOPIC_ID || "1",
    },
    nansen: { key: (env.NANSEN_API_KEY || "").trim(), base: (env.NANSEN_BASE_URL || "https://api.nansen.ai/api/beta").replace(/\/$/, "") },
    elfa: { key: (env.ELFA_API_KEY || "").trim(), base: (env.ELFA_BASE_URL || "https://api.elfa.ai").replace(/\/$/, "") },
    surf: { key: (env.SURF_API_KEY || "").trim(), base: (env.SURF_BASE_URL || "https://api.asksurf.ai").replace(/\/$/, "") },
    // Limitless Exchange (Base) prediction markets — public, no key. Configurable
    // so a different prediction-market source can be swapped in via env.
    limitless: { base: (env.LIMITLESS_API_URL || "https://api.limitless.exchange").replace(/\/$/, "") },
  },
  windows: {
    commit: Number(env.ROUND_COMMIT_SECONDS || 180),
    reveal: Number(env.ROUND_REVEAL_SECONDS || 180),
    settle: Number(env.ROUND_SETTLE_SECONDS || 180),
  },
  // Champion copy-trade (Merchant Moe). 0 amount = skip in the run loop.
  champion: {
    tradeAmount: env.CHAMPION_TRADE_AMOUNT ? BigInt(env.CHAMPION_TRADE_AMOUNT) : 0n,
    minOut: env.CHAMPION_MIN_OUT ? BigInt(env.CHAMPION_MIN_OUT) : 0n,
  },
  stateDir: resolve(here, "../.state"),
};

export function chain() {
  return chainById(cfg.addresses.chainId);
}

export function hasWallet(): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(cfg.privateKey);
}
