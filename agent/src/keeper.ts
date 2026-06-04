/**
 * Turing Arena KEEPER — keeps the live on-chain rounds from ever going stale.
 *
 * ONE invocation == ONE "tick". No blocking loops; the process exits when the
 * tick finishes (a GitHub Actions cron drives the cadence). Each tick, in order:
 *
 *   A. Fetch a REAL ETH/USD price (Pyth Hermes, CoinGecko fallback).
 *   B. Push it to BOTH oracles (ReporterPriceOracle + the MockLBQuoter behind
 *      MantleDexOracle) so rounds on either oracle settle at the real price.
 *   C. Settle every due round (paginated, idempotent).
 *   D. Reveal our AI personas inside their reveal window.
 *   E. Keep a commit window open: open a fresh round + commit all 5 personas.
 *
 * Durable state lives in repo-root `keeper-state/` (committed to git — it only
 * holds public reveal preimages + the persona agentIds, never the key):
 *   keeper-state/agents.json              personaName -> agentId
 *   keeper-state/cursor.json              settle low-water-mark + last price
 *   keeper-state/reveals/r<rid>-a<aid>.json  {predictedBps,confidence,rationaleHash,salt,agentId}
 *
 *   Run one tick locally:
 *     PRIVATE_KEY=0x… pnpm --filter @turing-arena/agent keeper
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type Abi,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseEventLogs,
  parseUnits,
  toBytes,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  type Signal,
  type SignalBundle,
  assetId,
  chainById,
  championVaultAbi,
  identityRegistryAbi,
  proofOfAlphaAbi,
  reporterPriceOracleAbi,
} from "@turing-arena/shared";
import { type Persona, decide } from "./brain";
import { CAST } from "./personas";
import { gatherSignals } from "./signals";

// --------------------------------------------------------------------------- //
//  Paths & durable state
// --------------------------------------------------------------------------- //

const here = dirname(fileURLToPath(import.meta.url)); // agent/src
const repoRoot = resolve(here, "../.."); // turing-arena/
const STATE_DIR = join(repoRoot, "keeper-state");
const REVEALS_DIR = join(STATE_DIR, "reveals");
const AGENTS_PATH = join(STATE_DIR, "agents.json");
const CURSOR_PATH = join(STATE_DIR, "cursor.json");

function ensureDirs(): void {
  mkdirSync(STATE_DIR, { recursive: true });
  mkdirSync(REVEALS_DIR, { recursive: true });
}
function readJson<T>(path: string, fallback: T): T {
  try {
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

interface AgentsFile {
  [personaName: string]: number; // agentId
}
interface CursorFile {
  /// Highest roundId that is fully settled and never needs scanning again.
  lowWaterMark: number;
  /// Last real price we pushed (USD) + when — used as a tick-to-tick momentum signal.
  lastPrice?: number;
  lastPriceAt?: number;
  /// Highest round whose champion we've already copy-traded on Merchant Moe.
  lastChampionRound?: number;
}
interface RevealRecord {
  agentId: number;
  predictedBps: number;
  confidence: number;
  rationaleHash: Hex;
  salt: Hex;
  rationale?: string;
  name?: string;
  source?: string;
  model?: string;
}

function revealPath(roundId: bigint, agentId: bigint): string {
  return join(REVEALS_DIR, `r${roundId}-a${agentId}.json`);
}

// --------------------------------------------------------------------------- //
//  Config (env overrides, deployment JSON fallback so the workflow is lean)
// --------------------------------------------------------------------------- //

const env = process.env;

function deployment(file: string): Record<string, string> {
  return readJson<Record<string, string>>(join(repoRoot, "contracts", "deployments", file), {});
}
const core = deployment("5003.json");
const defi = deployment("5003-defi.json");

function pick(...vals: (string | undefined)[]): string | undefined {
  for (const v of vals) if (v && v.length > 0) return v;
  return undefined;
}

const CHAIN_ID = Number(pick(env.CHAIN_ID, env.NEXT_PUBLIC_CHAIN_ID, core.chainId as unknown as string) ?? "5003");
const RPC_URL = pick(env.MANTLE_SEPOLIA_RPC_URL, env.RPC_URL) ?? "https://rpc.sepolia.mantle.xyz";

const PROOF_OF_ALPHA = pick(
  env.PROOF_OF_ALPHA_ADDRESS,
  env.NEXT_PUBLIC_PROOF_OF_ALPHA_ADDRESS,
  core.proofOfAlpha,
) as Address | undefined;
const IDENTITY_REGISTRY = pick(
  env.IDENTITY_REGISTRY_ADDRESS,
  env.NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS,
  core.identityRegistry,
) as Address | undefined;
const REPORTER_ORACLE = pick(
  env.PRICE_ORACLE_ADDRESS,
  env.NEXT_PUBLIC_PRICE_ORACLE_ADDRESS,
  core.priceOracle,
) as Address | undefined;
const MANTLE_DEX_ORACLE = pick(
  env.MANTLE_DEX_ORACLE_ADDRESS,
  env.NEXT_PUBLIC_MANTLE_DEX_ORACLE_ADDRESS,
  defi.mantleDexOracle,
) as Address | undefined;
const CHAMPION_VAULT = pick(
  env.CHAMPION_VAULT_ADDRESS,
  env.NEXT_PUBLIC_CHAMPION_VAULT_ADDRESS,
  defi.championVault,
) as Address | undefined;

const PRIVATE_KEY = (env.PRIVATE_KEY || "").trim();

/// Arena asset for the rounds the keeper opens. The DefiMock route is keyed on
/// METH/USD; we settle it against the same real ETH/USD price (mETH≈ETH for the
/// benchmark) so either oracle resolves to a real market number.
const ASSET = env.KEEPER_ASSET || "METH/USD";

/// Round windows (seconds from now): commit / reveal-end / settle.
const COMMIT_SECS = Number(env.KEEPER_COMMIT_SECONDS || 600);
const REVEAL_SECS = Number(env.KEEPER_REVEAL_SECONDS || 300);
const SETTLE_SECS = Number(env.KEEPER_SETTLE_SECONDS || 180);

const SETTLE_PAGE = 200; // participants processed per settle() call

// Pyth Hermes ETH/USD price feed id.
const PYTH_ETH_USD = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

// --------------------------------------------------------------------------- //
//  Minimal extra ABIs (MantleDexOracle.quoter + MockLBQuoter.setPrice/price)
// --------------------------------------------------------------------------- //

const mantleDexOracleAbi = [
  { type: "function", name: "quoter", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
] as const satisfies Abi;

const mockQuoterAbi = [
  { type: "function", name: "price", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "setPrice", stateMutability: "nonpayable", inputs: [{ name: "p", type: "uint256" }], outputs: [] },
] as const satisfies Abi;

// --------------------------------------------------------------------------- //
//  viem clients
// --------------------------------------------------------------------------- //

function requireConfig(): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
    throw new Error("PRIVATE_KEY missing/invalid. Set a 0x… 32-byte key (env or .env).");
  }
  if (!PROOF_OF_ALPHA || !IDENTITY_REGISTRY || !REPORTER_ORACLE) {
    throw new Error("Contract addresses missing. Provide *_ADDRESS env vars or deployments/5003.json.");
  }
}

const chain = chainById(CHAIN_ID);
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const account = () => privateKeyToAccount(PRIVATE_KEY as Hex);
const wallet = () => createWalletClient({ account: account(), chain, transport: http(RPC_URL) });

const explorerTx = (h: Hex) => `${chain.blockExplorers?.default.url ?? ""}/tx/${h}`;
const nowSec = () => Math.floor(Date.now() / 1000);
const log = (...a: unknown[]) => console.log(...a);

/// Send a write tx and wait for the receipt. Returns the hash.
async function send(args: Parameters<ReturnType<typeof wallet>["writeContract"]>[0]): Promise<Hex> {
  const hash = await wallet().writeContract(args);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

/// Recognize "this is a benign already-done / not-yet revert" so the keeper can
/// treat it as a no-op instead of crashing the whole tick.
function isBenignRevert(e: unknown, names: string[]): boolean {
  const blob = JSON.stringify(
    {
      m: (e as { message?: string })?.message,
      s: (e as { shortMessage?: string })?.shortMessage,
      d: (e as { details?: string })?.details,
      n: (e as { name?: string })?.name,
      c: (e as { cause?: { message?: string } })?.cause?.message,
    },
    null,
    0,
  );
  return names.some((n) => blob.includes(n));
}

// --------------------------------------------------------------------------- //
//  A. Real price
// --------------------------------------------------------------------------- //

async function fetchPythEthUsd(): Promise<number | null> {
  try {
    const url = `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${PYTH_ETH_USD}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const json: any = await res.json();
    const parsed = json?.parsed;
    const p = parsed?.[0]?.price;
    if (!p) return null;
    const value = Number(p.price) * 10 ** Number(p.expo);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

async function fetchCoinGeckoEthUsd(): Promise<number | null> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", {
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    const v = Number(json?.ethereum?.usd);
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

/// Reject 0 / absurd values so a feed glitch never settles a round at a bad price.
function sane(price: number | null): price is number {
  return price !== null && Number.isFinite(price) && price > 50 && price < 1_000_000;
}

async function getRealEthUsd(): Promise<{ price: number; source: string }> {
  const pyth = await fetchPythEthUsd();
  if (sane(pyth)) return { price: pyth, source: "pyth" };
  log("  ⚠ Pyth Hermes unavailable/insane — falling back to CoinGecko");
  const cg = await fetchCoinGeckoEthUsd();
  if (sane(cg)) return { price: cg, source: "coingecko" };
  throw new Error("No sane ETH/USD price from Pyth or CoinGecko this tick");
}

const to1e8 = (usd: number): bigint => BigInt(Math.round(usd * 1e8));
const to1e18 = (usd: number): bigint => BigInt(Math.round(usd * 1e6)) * 10n ** 12n; // 1e18 without FP overflow

// --------------------------------------------------------------------------- //
//  B. Push the real price to BOTH oracles
// --------------------------------------------------------------------------- //

async function pushPrices(price: number, source: string): Promise<void> {
  const aid = assetId(ASSET);
  // ReporterPriceOracle (1e8 USD)
  try {
    const h = await send({
      address: REPORTER_ORACLE as Address,
      abi: reporterPriceOracleAbi,
      functionName: "reportPrice",
      args: [aid, to1e8(price), `pyth:${source}`],
    });
    log(`  ✓ reportPrice ${ASSET} = $${price.toFixed(2)} (1e8)  ${explorerTx(h)}`);
  } catch (e) {
    log(`  ✗ reportPrice failed: ${(e as Error)?.message?.split("\n")[0]}`);
  }

  // MockLBQuoter behind MantleDexOracle (quote-token out per 1e18 base → set 1e18 USD)
  if (MANTLE_DEX_ORACLE) {
    try {
      const quoter = (await publicClient.readContract({
        address: MANTLE_DEX_ORACLE,
        abi: mantleDexOracleAbi,
        functionName: "quoter",
      })) as Address;
      const h = await send({
        address: quoter,
        abi: mockQuoterAbi,
        functionName: "setPrice",
        args: [to1e18(price)],
      });
      log(`  ✓ MockLBQuoter.setPrice = $${price.toFixed(2)} (1e18) @ ${quoter}  ${explorerTx(h)}`);
    } catch (e) {
      // Real LBQuoter on mainnet has no setPrice — that's fine, settlement just
      // reads live DEX liquidity there. On testnet this is the mock and works.
      log(`  · MockLBQuoter.setPrice skipped: ${(e as Error)?.message?.split("\n")[0]}`);
    }
  }
}

// --------------------------------------------------------------------------- //
//  On-chain reads
// --------------------------------------------------------------------------- //

type Round = {
  asset: Hex;
  oracle: Address;
  commitDeadline: bigint;
  revealDeadline: bigint;
  settleTime: bigint;
  settled: boolean;
  rewardClaimed: boolean;
  hasWinner: boolean;
  revealCount: number;
  settleCursor: number;
  entryPrice: bigint;
  settlePrice: bigint;
  stake: bigint;
  prizePool: bigint;
  topAgentId: bigint;
  topScore: bigint;
  title: string;
};

async function roundCount(): Promise<bigint> {
  return (await publicClient.readContract({
    address: PROOF_OF_ALPHA as Address,
    abi: proofOfAlphaAbi,
    functionName: "roundCount",
  })) as bigint;
}
async function getRound(roundId: bigint): Promise<Round> {
  return (await publicClient.readContract({
    address: PROOF_OF_ALPHA as Address,
    abi: proofOfAlphaAbi,
    functionName: "getRound",
    args: [roundId],
  })) as Round;
}
async function isRevealed(roundId: bigint, agentId: bigint): Promise<boolean> {
  const e = (await publicClient.readContract({
    address: PROOF_OF_ALPHA as Address,
    abi: proofOfAlphaAbi,
    functionName: "getEntry",
    args: [roundId, agentId],
  })) as { commitHash: Hex; revealed: boolean };
  return e.revealed;
}

// --------------------------------------------------------------------------- //
//  C. Settle due rounds (paginated, idempotent, cursor-advanced)
// --------------------------------------------------------------------------- //

async function settleDueRounds(cursor: CursorFile): Promise<void> {
  const count = await roundCount();
  if (count === 0n) return;
  const now = nowSec();
  let newLowWater = cursor.lowWaterMark;
  let contiguousSettled = true; // can only advance the low-water-mark while unbroken

  for (let id = BigInt(cursor.lowWaterMark + 1); id <= count; id++) {
    let round: Round;
    try {
      round = await getRound(id);
    } catch {
      contiguousSettled = false;
      continue;
    }

    if (round.settled) {
      if (contiguousSettled) newLowWater = Number(id);
      continue;
    }
    contiguousSettled = false; // a live round below the head blocks low-water advance

    if (now < Number(round.settleTime)) continue; // not yet due

    log(`  ⚖ settling round #${id} (${round.title})`);
    for (let guard = 0; guard < 64; guard++) {
      try {
        const h = await send({
          address: PROOF_OF_ALPHA as Address,
          abi: proofOfAlphaAbi,
          functionName: "settle",
          args: [id, BigInt(SETTLE_PAGE)],
        });
        log(`     · settle page  ${explorerTx(h)}`);
      } catch (e) {
        // A revert here is usually benign: the round is already fully settled (a
        // prior page landed) or not settleable yet (the chain clock is a beat
        // behind at the boundary). Confirm against the chain so we log the real
        // state rather than a scary "revert" for an expected case.
        const chk = await getRound(id).catch(() => null);
        if (chk?.settled) {
          log(`     ✓ round #${id} fully settled`);
        } else if (chk && nowSec() < Number(chk.settleTime)) {
          log(`     · round #${id} not settleable yet; will retry next tick`);
        } else if (!isBenignRevert(e, ["AlreadySettled", "NotYetSettleable"])) {
          log(`     ✗ settle revert: ${(e as Error)?.message?.split("\n")[0]}`);
        }
        break;
      }
      // Re-read whether the round finished, tolerating the flaky RPC's read lag:
      // a stale settled:false here would queue a needless extra (reverting) page.
      let after = await getRound(id);
      for (let r = 0; r < 4 && !after.settled; r++) {
        await new Promise((res) => setTimeout(res, 350));
        after = await getRound(id);
      }
      if (after.settled) {
        log(`     ✓ round #${id} fully settled`);
        break;
      }
    }
  }

  if (newLowWater !== cursor.lowWaterMark) {
    log(`  ↪ cursor lowWaterMark ${cursor.lowWaterMark} → ${newLowWater}`);
    cursor.lowWaterMark = newLowWater;
  }
}

// --------------------------------------------------------------------------- //
//  C.5. Copy-trade each newly-settled round's champion on Merchant Moe (real
//       Mantle DeFi flow). The vault reads the winner's direction on-chain
//       (unspoofable); the keeper only sizes + submits.
// --------------------------------------------------------------------------- //

async function copyTradeChampions(cursor: CursorFile): Promise<void> {
  if (!CHAMPION_VAULT) return; // DeFi layer not deployed on this chain
  const count = await roundCount();
  if (count === 0n) return;

  // Continue from where we left off; on a cold start only copy-trade the last
  // few settled rounds rather than back-filling the entire history at once.
  const from = cursor.lastChampionRound != null ? cursor.lastChampionRound + 1 : Math.max(1, Number(count) - 6);
  for (let id = BigInt(from); id <= count; id++) {
    let round: Round;
    try {
      round = await getRound(id);
    } catch {
      break; // RPC hiccup — resume from the same cursor next tick
    }
    if (!round.settled) break; // process strictly in order; stop at the first open round
    cursor.lastChampionRound = Number(id); // mark seen regardless of outcome (vault.traded guards double-trades)
    if (!round.hasWinner || round.topAgentId === 0n) continue;

    try {
      const entry = (await publicClient.readContract({
        address: PROOF_OF_ALPHA as Address,
        abi: proofOfAlphaAbi,
        functionName: "getEntry",
        args: [id, round.topAgentId],
      })) as { predictedBps: bigint };
      if (entry.predictedBps === 0n) continue;
      const long = entry.predictedBps > 0n;
      // tokenIn is USDY when long (buy mETH) / mETH when short. The testnet mock
      // router swaps ~1:1, so keep the size small + symmetric: the champion
      // portfolio drifts believably round-to-round instead of ballooning. minOut 0
      // is fine against the deterministic mock (on mainnet: quote it via LBQuoter).
      const amountIn = parseUnits("0.1", 18);
      const h = await send({
        address: CHAMPION_VAULT as Address,
        abi: championVaultAbi,
        functionName: "executeChampionTrade",
        args: [id, amountIn, 0n, BigInt(nowSec() + 600)],
      });
      log(`  💰 champion copy-trade round #${id} (agent #${round.topAgentId} ${long ? "LONG" : "SHORT"}) → Merchant Moe  ${explorerTx(h)}`);
    } catch (e) {
      if (isBenignRevert(e, ["AlreadyTraded", "NoChampion", "NoDirection", "RoundNotSettled"]) || isConcurrentKeeperError(e)) {
        log(`  · champion trade round #${id} skipped (${(e as Error)?.message?.split("\n")[0]})`);
      } else {
        log(`  ✗ champion trade round #${id} failed: ${(e as Error)?.message?.split("\n")[0]}`);
      }
    }
  }
}

// --------------------------------------------------------------------------- //
//  D. Reveal our personas inside their reveal window
// --------------------------------------------------------------------------- //

async function revealPersonas(cursor: CursorFile): Promise<void> {
  const count = await roundCount();
  const now = nowSec();

  for (let id = BigInt(cursor.lowWaterMark + 1); id <= count; id++) {
    let round: Round;
    try {
      round = await getRound(id);
    } catch {
      continue;
    }
    if (round.settled) continue;
    if (!(now > Number(round.commitDeadline) && now <= Number(round.revealDeadline))) continue;

    // Reveal every persona we have a saved preimage for.
    const records = loadRevealsForRound(id);
    for (const rec of records) {
      const agentId = BigInt(rec.agentId);
      let revealed: boolean;
      try {
        revealed = await isRevealed(id, agentId);
      } catch {
        continue;
      }
      if (revealed) continue;

      try {
        const h = await send({
          address: PROOF_OF_ALPHA as Address,
          abi: proofOfAlphaAbi,
          functionName: "reveal",
          args: [id, agentId, BigInt(rec.predictedBps), rec.confidence, rec.rationaleHash, rec.salt],
        });
        log(`  🔓 revealed round #${id} agent #${agentId} (${rec.name ?? "?"})  ${explorerTx(h)}`);
      } catch (e) {
        if (isBenignRevert(e, ["AlreadyRevealed", "RevealClosed", "CommitMismatch", "NothingCommitted"])) {
          continue;
        }
        log(`     ✗ reveal revert (r${id} a${agentId}): ${(e as Error)?.message?.split("\n")[0]}`);
      }
    }
  }
}

function loadRevealsForRound(roundId: bigint): RevealRecord[] {
  const prefix = `r${roundId}-a`;
  let files: string[] = [];
  try {
    files = readdirSync(REVEALS_DIR).filter((f) => f.startsWith(prefix) && f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: RevealRecord[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(readFileSync(join(REVEALS_DIR, f), "utf8")) as RevealRecord);
    } catch {
      // ignore a corrupt file
    }
  }
  return out;
}

// --------------------------------------------------------------------------- //
//  Personas + deterministic per-persona predictions
// --------------------------------------------------------------------------- //

interface PersonaDef {
  name: string;
  kind: "AI" | "HUMAN";
  description: string;
  signals?: string[];
}

/// All five competitors. Athena reuses agent #1 (already registered); the rest
/// are registered once and then reused so reputation compounds.
const PERSONAS: PersonaDef[] = [
  {
    name: "Athena",
    kind: "AI",
    description: "Disciplined multi-signal quant; blended, moderate long bias.",
    signals: ["allora", "nansen", "elfa", "surf", "mantle-onchain"],
  },
  { name: "Allora Scout", kind: "AI", description: "Single decentralized-ML signal; long-leaning.", signals: ["allora"] },
  { name: "Momentum Max", kind: "AI", description: "Trend-follower; leans hard into short momentum.", signals: ["momentum"] },
  { name: "Contrarian Cora", kind: "AI", description: "Mean-reversion contrarian; fades short momentum.", signals: ["momentum"] },
  { name: "HODLer Hank", kind: "HUMAN", description: "Retail human; structurally long, trades on gut.", signals: ["gut"] },
  // Celebrity AI agents (registered once, then reused so reputation compounds).
  { name: "Elon Musk", kind: "AI", description: "Meme-fueled moonshot trader; amplifies momentum, loves volatility.", signals: ["momentum", "elfa"] },
  { name: "Donald Trump", kind: "AI", description: "Brash permabull; always certain the move is tremendous.", signals: ["momentum"] },
  { name: "Justin Sun", kind: "AI", description: "Hype-driven crypto mogul; relentless upside, long and loud.", signals: ["elfa", "nansen"] },
  { name: "Michael Saylor", kind: "AI", description: "Maximalist; structurally long forever, buys every dip.", signals: ["mantle-onchain"] },
  { name: "Warren Buffett", kind: "AI", description: "Patient value investor; fades hype, greedy when others panic.", signals: ["momentum"] },
  { name: "Vitalik Buterin", kind: "AI", description: "Fundamentals-first builder; weighs the long term, ignores noise.", signals: ["allora", "mantle-onchain"] },
  { name: "Sam Altman", kind: "AI", description: "AGI optimist; bets big on the exponential, moonshot-bullish.", signals: ["allora", "surf"] },
  { name: "Cathie Wood", kind: "AI", description: "Disruptive-innovation conviction; rides growth momentum hard.", signals: ["momentum", "surf"] },
  { name: "Arthur Hayes", kind: "AI", description: "Leverage-loving macro degen; amplifies the trend.", signals: ["momentum", "nansen"] },
  { name: "Peter Schiff", kind: "AI", description: "Gold bug and perma-bear; fades every crypto rally.", signals: ["momentum"] },
  { name: "Ray Dalio", kind: "AI", description: "All-weather macro; diversified, measured, low-conviction.", signals: ["allora", "mantle-onchain"] },
];

/// FNV-1a → [0,1), deterministic. (Mirrors agent/src/signals/util.hash01.)
function hash01(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function clampInt(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(x)));
}

/// Short-momentum read in [-1,1]. Real when we have a prior tick price; otherwise
/// a deterministic per-(round,price-bucket) pseudo-signal so calls still vary.
function momentumSignal(roundId: bigint, price: number, cursor: CursorFile): number {
  if (typeof cursor.lastPrice === "number" && cursor.lastPrice > 0) {
    const chg = (price - cursor.lastPrice) / cursor.lastPrice; // fractional move since last tick
    // Scale a small fractional move into a bounded conviction read.
    const m = Math.max(-1, Math.min(1, chg * 120));
    if (Math.abs(m) > 0.02) return m;
  }
  // Fallback: deterministic but evolves with the price + round.
  return hash01(`mom:${roundId}:${Math.round(price / 5)}`) * 2 - 1;
}

interface Prediction {
  predictedBps: number;
  confidence: number;
  rationale: string;
}

/// Lightweight, deterministic per-persona heuristic. Varies direction sign +
/// confidence so the leaderboard tells a Human-vs-AI story, all keyless.
function predictFor(persona: PersonaDef, roundId: bigint, price: number, mom: number): Prediction {
  const jitter = hash01(`${persona.name}:${roundId}:${Math.round(price)}`); // [0,1)
  let net: number; // [-1,1] directional conviction
  let conf: number;

  switch (persona.name) {
    case "Momentum Max": // follow short momentum, levered
      net = Math.max(-1, Math.min(1, mom * 1.7));
      conf = 40 + Math.abs(net) * 55;
      break;
    case "Contrarian Cora": // fade the crowd
      net = Math.max(-1, Math.min(1, -mom * 1.1));
      conf = 35 + Math.abs(net) * 50;
      break;
    case "Athena": // blended, moderate, structurally long-tilted
      net = Math.max(-1, Math.min(1, 0.25 + mom * 0.5));
      conf = 45 + Math.abs(net) * 40;
      break;
    case "Allora Scout": // single signal, long-leaning
      net = Math.max(-1, Math.min(1, 0.15 + (jitter * 2 - 1) * 0.7));
      conf = 30 + Math.abs(net) * 55;
      break;
    case "HODLer Hank": // mild structural long, gut feel
    default:
      net = Math.max(-1, Math.min(1, 0.35 + jitter * 0.25));
      conf = 30 + Math.abs(net) * 45;
      break;
  }

  // Add a touch of per-round jitter to the magnitude so rounds aren't identical.
  const predictedBps = Math.round(net * (450 + jitter * 200)); // bounded well under MAX_ABS_BPS (2000)
  const confidence = clampInt(conf, 1, 100);
  const dir = predictedBps > 0 ? "UP" : predictedBps < 0 ? "DOWN" : "FLAT";
  const rationale = `${persona.name}: ${dir} ${predictedBps}bps @ conf ${confidence} — ${persona.description} (mom ${mom.toFixed(2)})`;
  return { predictedBps, confidence, rationale };
}

// --------------------------------------------------------------------------- //
//  Identity: persona -> agentId (register once, then reuse)
// --------------------------------------------------------------------------- //

/// Human-readable strategy label shown as the agent's "model" on the leaderboard.
const STRATEGY_BY_NAME: Record<string, string> = {
  Athena: "multi-signal fusion",
  "Allora Scout": "Allora ML inference",
  "Momentum Max": "trend-follower",
  "Contrarian Cora": "mean-reversion",
  "HODLer Hank": "gut + structural long",
  "Elon Musk": "meme momentum",
  "Donald Trump": "permabull conviction",
  "Justin Sun": "hype-driven momentum",
  "Michael Saylor": "Bitcoin-maximalist long",
  "Warren Buffett": "value contrarian",
  "Vitalik Buterin": "fundamentals long-term",
  "Sam Altman": "AGI moonshot",
  "Cathie Wood": "disruptive innovation",
  "Arthur Hayes": "leverage macro",
  "Peter Schiff": "perma-bear gold bug",
  "Ray Dalio": "macro all-weather",
};

function agentCardUri(p: PersonaDef): string {
  const json = JSON.stringify({
    name: p.name,
    description: `Turing Arena ${p.kind} agent — ${p.description}`,
    kind: p.kind,
    model: STRATEGY_BY_NAME[p.name] ?? "multi-signal fusion",
    signals: p.signals,
    protocol: "erc-8004",
    skill: "proof-of-alpha",
  });
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

async function agentUri(agentId: bigint): Promise<string | null> {
  try {
    return (await publicClient.readContract({
      address: IDENTITY_REGISTRY as Address,
      abi: identityRegistryAbi,
      functionName: "agentURI",
      args: [agentId],
    })) as string;
  } catch {
    return null;
  }
}

async function registerPersona(p: PersonaDef): Promise<bigint> {
  const hash = await wallet().writeContract({
    address: IDENTITY_REGISTRY as Address,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentCardUri(p)],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: identityRegistryAbi, logs: receipt.logs, eventName: "Registered" });
  const agentId = logs[0]?.args?.agentId as bigint | undefined;
  if (agentId === undefined) throw new Error(`register(${p.name}): could not parse agentId`);
  log(`  ＋ registered ${p.name} → agent #${agentId}  ${explorerTx(hash)}`);
  return agentId;
}

/// Resolve agentIds for all personas, registering any that aren't mapped yet.
/// Athena is bound to the pre-existing agent #1 unless that token says otherwise.
async function ensureAgents(agents: AgentsFile): Promise<AgentsFile> {
  // Bind Athena to agent #1 if it exists and looks like Athena (or is unset).
  if (agents.Athena === undefined) {
    const uri = await agentUri(1n);
    if (uri && /athena/i.test(decodeAgentName(uri))) {
      agents.Athena = 1;
      log("  ✓ reusing pre-registered agent #1 for Athena");
    }
  }

  for (const p of PERSONAS) {
    if (typeof agents[p.name] === "number") continue;
    const id = await registerPersona(p);
    agents[p.name] = Number(id);
    writeJson(AGENTS_PATH, agents); // persist incrementally so a mid-loop crash never re-registers
  }
  return agents;
}

function decodeAgentName(uri: string): string {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString("utf8"));
      return String(json?.name ?? "");
    }
    if (uri.startsWith("data:application/json,")) {
      return String(JSON.parse(decodeURIComponent(uri.split(",")[1]))?.name ?? "");
    }
  } catch {
    /* fallthrough */
  }
  return uri;
}

// --------------------------------------------------------------------------- //
//  Commit hashing (mirror of ProofOfAlpha.computeCommit / chain.ts)
// --------------------------------------------------------------------------- //

function rationaleHashOf(rationale: string): Hex {
  return keccak256(toBytes(rationale));
}
function randomSalt(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}
function computeCommitHash(
  agentId: bigint,
  predictedBps: number,
  confidence: number,
  rationaleHash: Hex,
  salt: Hex,
): Hex {
  const encoded = encodeAbiParameters(
    [{ type: "uint256" }, { type: "int256" }, { type: "uint8" }, { type: "bytes32" }, { type: "bytes32" }] as const,
    [agentId, BigInt(predictedBps), confidence, rationaleHash, salt],
  );
  return keccak256(encoded);
}

// --------------------------------------------------------------------------- //
//  E. Keep a commit window open
// --------------------------------------------------------------------------- //

/// Is there already a round accepting commits (so we don't open a duplicate)?
async function hasOpenCommitWindow(): Promise<boolean> {
  const count = await roundCount();
  const now = nowSec();
  // Scan from the head backward; the open one (if any) is recent.
  for (let id = count; id >= 1n; id--) {
    let round: Round;
    try {
      round = await getRound(id);
    } catch {
      continue;
    }
    if (!round.settled && now <= Number(round.commitDeadline)) return true;
    // Once we pass a settled round at the head we can stop early-ish; but cheap
    // enough to keep scanning a few. Stop after we go below a settled head run.
  }
  return false;
}

async function openRoundAndCommit(agents: AgentsFile, price: number, cursor: CursorFile): Promise<void> {
  const now = nowSec();
  const commitDeadline = BigInt(now + COMMIT_SECS);
  const revealDeadline = commitDeadline + BigInt(REVEAL_SECS);
  const settleTime = revealDeadline + BigInt(SETTLE_SECS);

  log(`  ＋ opening a fresh round for ${ASSET} (commit ${COMMIT_SECS}s / reveal ${REVEAL_SECS}s / settle ${SETTLE_SECS}s)`);
  const openHash = await wallet().writeContract({
    address: PROOF_OF_ALPHA as Address,
    abi: proofOfAlphaAbi,
    functionName: "openRound",
    args: [
      assetId(ASSET),
      REPORTER_ORACLE as Address,
      "ETH/USD live - real Pyth price",
      commitDeadline,
      revealDeadline,
      settleTime,
      0n,
    ],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: openHash });
  const logs = parseEventLogs({ abi: proofOfAlphaAbi, logs: receipt.logs, eventName: "RoundOpened" });
  const roundId = logs[0]?.args?.roundId as bigint | undefined;
  if (roundId === undefined) throw new Error("openRound: could not parse roundId from logs");
  log(`  ✓ opened round #${roundId}  ${explorerTx(openHash)}`);

  const mom = momentumSignal(roundId, price, cursor);
  const momLive = typeof cursor.lastPrice === "number" && cursor.lastPrice > 0;

  // Gather the signal context ONCE for the whole round: the five adapters (mock
  // until their sponsor keys are set) plus the REAL Pyth momentum injected as a
  // live, heavily-weighted signal, so every agent reasons over genuine market
  // data. Each persona then filters/biases this same snapshot; Athena, when an
  // LLM key is present, reasons over it with the model. The resulting rationale
  // is sealed on-chain (rationaleHash) at commit and revealed verbatim after.
  const bundle = await gatherSignals(ASSET, Number(roundId));
  bundle.signals.push({
    source: "momentum",
    score: mom,
    weight: 0.6,
    note: `ETH ${mom >= 0 ? "up" : "down"}-momentum since the last tick${momLive ? " (Pyth, live)" : ""}`,
    live: momLive,
  } as Signal);

  for (const persona of CAST) {
    const idNum = agents[persona.name];
    if (idNum === undefined) {
      log(`     · no agentId mapped for ${persona.name}, skipping`);
      continue;
    }
    const agentId = BigInt(idNum);
    try {
      const { predictedBps, confidence, rationale, model } = await decide(bundle, persona);
      const rationaleHash = rationaleHashOf(rationale);
      const salt = randomSalt();
      const commitHash = computeCommitHash(agentId, predictedBps, confidence, rationaleHash, salt);

      // PERSIST the reveal preimage (incl. the human-readable rationale and the
      // model that produced it) BEFORE the commit tx, so a crash still reveals.
      const rec: RevealRecord = {
        agentId: Number(agentId),
        predictedBps,
        confidence,
        rationaleHash,
        salt,
        rationale,
        name: persona.name,
        source: "pyth",
        model,
      };
      writeJson(revealPath(roundId, agentId), rec);

      const h = await send({
        address: PROOF_OF_ALPHA as Address,
        abi: proofOfAlphaAbi,
        functionName: "commit",
        args: [roundId, agentId, commitHash],
      });
      log(`  🔒 committed ${persona.name} (#${agentId}) ${predictedBps}bps@${confidence} [${model}]  ${explorerTx(h)}`);
    } catch (e) {
      if (isBenignRevert(e, ["AlreadyCommitted", "CommitClosed"])) {
        log(`     · ${persona.name} commit already present / window closed`);
        continue;
      }
      log(`     ✗ commit failed for ${persona.name}: ${(e as Error)?.message?.split("\n")[0]}`);
      // continue with the other personas — don't abort the round
    }
  }
}

// --------------------------------------------------------------------------- //
//  E.5 Auto-pilot — run user-deployed agents that delegated control to us
// --------------------------------------------------------------------------- //

const ZERO32 = `0x${"0".repeat(64)}` as Hex;

/// Strategy id -> conviction transform, mirroring web/lib/strategy.ts so a user
/// agent reasons in the keeper exactly as the deploy UI advertised.
const STRATEGY_BIAS: Record<string, (m: number) => number> = {
  momentum: (m) => m * 1.7,
  contrarian: (m) => -m * 1.1,
  fusion: (m) => 0.25 + m * 0.5,
  long: (m) => 0.35 + m * 0.25,
  scout: (m) => 0.15 + m * 0.6,
};

function decodeAgentCard(uri: string): { name?: string; strategy?: string; persona?: string } {
  try {
    if (uri.startsWith("data:application/json;base64,")) {
      return JSON.parse(Buffer.from(uri.slice("data:application/json;base64,".length), "base64").toString("utf8"));
    }
    if (uri.startsWith("data:application/json,")) {
      return JSON.parse(decodeURIComponent(uri.slice("data:application/json,".length)));
    }
  } catch {
    /* malformed card */
  }
  return {};
}

function personaFromStrategy(name: string, stratId: string): Persona {
  return { name, kind: "AI", style: `a user-deployed ${stratId} agent`, bias: STRATEGY_BIAS[stratId], useLlm: false };
}

async function findOpenCommitRound(): Promise<bigint | null> {
  const count = await roundCount();
  const now = nowSec();
  for (let id = count; id >= 1n && id > count - 6n; id--) {
    try {
      const r = await getRound(id);
      if (!r.settled && now <= Number(r.commitDeadline)) return id;
    } catch {
      /* skip */
    }
  }
  return null;
}

/// Each tick: find the open round and commit, on their behalf, any user agent
/// that (a) bound our wallet via setAgentWallet and (b) carries a strategy in
/// its card. Reveal + settle for them ride the existing per-file paths.
async function commitAutopilots(price: number, cursor: CursorFile, houseIds: Set<number>): Promise<void> {
  let total: bigint;
  try {
    total = (await publicClient.readContract({
      address: IDENTITY_REGISTRY as Address,
      abi: identityRegistryAbi,
      functionName: "totalAgents",
    })) as bigint;
  } catch {
    return;
  }
  if (Number(total) <= houseIds.size + 1) return; // only the house agents exist

  const roundId = await findOpenCommitRound();
  if (roundId === null) return;

  const keeper = account().address.toLowerCase();
  const mom = momentumSignal(roundId, price, cursor);
  const momLive = typeof cursor.lastPrice === "number" && cursor.lastPrice > 0;
  let bundle: SignalBundle | null = null;

  for (let id = 1n; id <= total; id++) {
    if (houseIds.has(Number(id))) continue;
    let wallet: string;
    let uri: string;
    try {
      wallet = (await publicClient.readContract({
        address: IDENTITY_REGISTRY as Address,
        abi: identityRegistryAbi,
        functionName: "getAgentWallet",
        args: [id],
      })) as string;
      if (wallet.toLowerCase() !== keeper) continue;
      uri = (await publicClient.readContract({
        address: IDENTITY_REGISTRY as Address,
        abi: identityRegistryAbi,
        functionName: "agentURI",
        args: [id],
      })) as string;
    } catch {
      continue;
    }
    const card = decodeAgentCard(uri);
    const isCustom = card.strategy === "custom" && !!card.persona;
    if (!isCustom && (!card.strategy || !STRATEGY_BIAS[card.strategy])) continue;

    try {
      const e = (await publicClient.readContract({
        address: PROOF_OF_ALPHA as Address,
        abi: proofOfAlphaAbi,
        functionName: "getEntry",
        args: [roundId, id],
      })) as { commitHash: Hex };
      if (e.commitHash && e.commitHash !== ZERO32) continue; // already called this round
    } catch {
      /* tolerate; attempt the commit anyway */
    }

    if (!bundle) {
      bundle = await gatherSignals(ASSET, Number(roundId));
      bundle.signals.push({
        source: "momentum",
        score: mom,
        weight: 0.6,
        note: `ETH ${mom >= 0 ? "up" : "down"}-momentum${momLive ? " (Pyth, live)" : ""}`,
        live: momLive,
      } as Signal);
    }

    const persona: Persona = isCustom
      ? { name: card.name ?? `Agent #${id}`, kind: "AI", style: card.persona as string, bias: STRATEGY_BIAS.fusion, useLlm: true }
      : personaFromStrategy(card.name ?? `Agent #${id}`, card.strategy as string);
    try {
      const { predictedBps, confidence, rationale, model } = await decide(bundle, persona);
      const rationaleHash = rationaleHashOf(rationale);
      const salt = randomSalt();
      const commitHash = computeCommitHash(id, predictedBps, confidence, rationaleHash, salt);
      writeJson(revealPath(roundId, id), {
        agentId: Number(id),
        predictedBps,
        confidence,
        rationaleHash,
        salt,
        rationale,
        name: card.name,
        source: "pyth",
        model,
      } as RevealRecord);
      const h = await send({
        address: PROOF_OF_ALPHA as Address,
        abi: proofOfAlphaAbi,
        functionName: "commit",
        args: [roundId, id, commitHash],
      });
      log(`  🤖 auto-pilot committed ${card.name ?? `#${id}`} (#${id}) ${predictedBps}bps@${confidence} [${model}]  ${explorerTx(h)}`);
    } catch (e) {
      if (isBenignRevert(e, ["AlreadyCommitted", "CommitClosed", "NotAgentController"])) continue;
      log(`     ✗ auto-pilot commit failed (#${id}): ${(e as Error)?.message?.split("\n")[0]}`);
    }
  }
}

// --------------------------------------------------------------------------- //
//  Tick
// --------------------------------------------------------------------------- //

async function tick(): Promise<void> {
  requireConfig();
  ensureDirs();

  log(`▶ Turing Arena keeper tick — ${new Date().toISOString()}`);
  log(`  chain ${chain.name} (${CHAIN_ID})  ·  operator ${account().address}`);
  log(`  PoA ${PROOF_OF_ALPHA}  ·  reporterOracle ${REPORTER_ORACLE}`);

  const agents = await ensureAgents(readJson<AgentsFile>(AGENTS_PATH, {}));
  writeJson(AGENTS_PATH, agents);

  const cursor = readJson<CursorFile>(CURSOR_PATH, { lowWaterMark: 0 });

  // A + B: real price → both oracles
  const { price, source } = await getRealEthUsd();
  log(`  price ETH/USD = $${price.toFixed(2)} (source ${source})`);
  await pushPrices(price, source);

  // C: settle everything due
  await settleDueRounds(cursor);

  // C.5: copy-trade each newly-settled round's champion on Merchant Moe (real DeFi)
  try {
    await copyTradeChampions(cursor);
  } catch (e) {
    if (!isConcurrentKeeperError(e)) log(`  · champion copy-trade step error: ${(e as Error)?.message?.split("\n")[0]}`);
  }

  // D: reveal personas in their reveal window
  await revealPersonas(cursor);

  // E: keep a commit window open
  if (await hasOpenCommitWindow()) {
    log("  ✓ a commit window is already open — not opening another");
  } else {
    try {
      await openRoundAndCommit(agents, price, cursor);
    } catch (e) {
      if (isConcurrentKeeperError(e)) {
        log(`  ⏭ another keeper opened this round first — skipping (${(e as Error)?.message?.split("\n")[0]})`);
      } else {
        throw e;
      }
    }
  }

  // E.5: run any user-deployed agents that delegated control to us (auto-pilot).
  try {
    await commitAutopilots(price, cursor, new Set(Object.values(agents)));
  } catch (e) {
    log(`  ✗ auto-pilot step error: ${(e as Error)?.message?.split("\n")[0]}`);
  }

  // Persist tick state (price drives next tick's momentum; cursor may have moved).
  cursor.lastPrice = price;
  cursor.lastPriceAt = nowSec();
  writeJson(CURSOR_PATH, cursor);

  log("✓ tick complete");
}

/// Errors that just mean "another keeper instance got there first". When the
/// cloud cron and a local fast loop tick at the same moment they can race on the
/// shared operator wallet's nonce, or on already-final round state. These are
/// harmless: the other keeper did the work, so the tick stays green, not red.
function isConcurrentKeeperError(e: unknown): boolean {
  const m = ((e as Error)?.message || String(e)).toLowerCase();
  return (
    m.includes("nonce too low") ||
    m.includes("nonce is too low") ||
    m.includes("already known") ||
    m.includes("replacement transaction underpriced") ||
    m.includes("alreadycommitted") ||
    m.includes("alreadyrevealed") ||
    m.includes("commitclosed") ||
    m.includes("revealclosed") ||
    m.includes("already settled") ||
    m.includes("nothingcommitted")
  );
}

tick()
  .then(() => process.exit(0))
  .catch((e) => {
    if (isConcurrentKeeperError(e)) {
      console.log(`↪ another keeper raced this tick (harmless): ${(e as Error)?.message?.split("\n")[0]}`);
      process.exit(0);
    }
    console.error(`✗ keeper tick failed: ${(e as Error)?.message || e}`);
    process.exit(1);
  });
