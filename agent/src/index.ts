/**
 * Turing Arena live agent — runs the autonomous on-chain loop on Mantle.
 *
 *   pnpm agent                  # run: register (if needed) -> commit -> reveal -> settle
 *   pnpm --filter @turing-arena/agent register
 *   pnpm --filter @turing-arena/agent report-price METH/USD 3000
 *   pnpm --filter @turing-arena/agent open-round  METH/USD "mETH/USD - 1h"
 *   pnpm --filter @turing-arena/agent settle      1
 *
 * Requires PRIVATE_KEY (funded with testnet MNT) + deployed *_ADDRESS in .env.
 */
import { fromOraclePrice } from "@turing-arena/shared";
import { gatherSignals } from "./signals";
import { ATHENA, decide } from "./brain";
import { spotPrice } from "./priceFeed";
import { llmAvailable } from "./llm";
import { banner, c, hr, log, pct } from "./logger";
import { chain, cfg, hasWallet } from "./config";
import {
  commitDecision,
  executeChampionTrade,
  findOpenRound,
  getAccount,
  getAgentStats,
  getRound,
  openRound,
  registerAgent,
  reportPrice,
  requireDeployed,
  revealDecision,
  settleRound,
} from "./chain";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const nowSec = () => Math.floor(Date.now() / 1000);
const explorerTx = (h: string) => `${chain().blockExplorers?.default.url}/tx/${h}`;

async function waitUntil(tsSeconds: bigint, label: string) {
  const target = Number(tsSeconds) + 5; // small buffer past the on-chain deadline
  while (nowSec() < target) {
    const left = target - nowSec();
    process.stdout.write(`\r   ${c.dim(`waiting for ${label}… ${left}s`)}   `);
    await sleep(Math.min(5000, left * 1000));
  }
  process.stdout.write("\r" + " ".repeat(48) + "\r");
}

async function ensureAgentId(): Promise<bigint> {
  if (cfg.agentId !== undefined) return cfg.agentId;
  log(c.dim("  No AGENT_ID set — registering a fresh ERC-8004 identity…"));
  const id = await registerAgent({
    name: cfg.agentName,
    kind: "AI",
    model: llmAvailable() ? cfg.llm.model : "heuristic-fusion",
    signals: ["allora", "nansen", "elfa", "surf", "mantle-onchain"],
  });
  log(`  ${c.green("✓")} minted agent #${c.bold(String(id))}  ${c.dim("→ set AGENT_ID=" + id + " in .env to reuse it")}`);
  return id;
}

async function ensureOraclePriceAndRound(): Promise<bigint> {
  const existing = await findOpenRound();
  if (existing) {
    log(`  Joining open round #${c.bold(String(existing.roundId))} — ${existing.round.title}`);
    return existing.roundId;
  }
  // operator path: push a real entry price, then open a round around it
  const spot = (await spotPrice(cfg.asset)) ?? 1;
  log(c.dim(`  Reporting entry price for ${cfg.asset}: $${spot}`));
  const ph = await reportPrice(cfg.asset, spot, "coingecko:spot");
  await sleep(1500);
  log(c.dim(`    price tx ${explorerTx(ph)}`));
  const roundId = await openRound(cfg.asset, `${cfg.asset} - arena`);
  log(`  ${c.green("✓")} opened round #${c.bold(String(roundId))}`);
  return roundId;
}

async function cmdRun() {
  requireDeployed();
  if (!hasWallet()) throw new Error("PRIVATE_KEY missing. Add a funded testnet key to .env (faucet: https://faucet.sepolia.mantle.xyz)");

  banner(`TURING ARENA — live agent "${cfg.agentName}" on ${chain().name}`);
  log(c.dim(`  operator ${getAccount().address}  ·  brain ${llmAvailable() ? "llm:" + cfg.llm.model : "heuristic-fusion"}\n`));

  const agentId = await ensureAgentId();
  const roundId = await ensureOraclePriceAndRound();
  const round: any = await getRound(roundId);

  // 1) think
  log(c.bold("\n  ① Gathering signals…"));
  const bundle = await gatherSignals(cfg.asset);
  for (const s of bundle.signals) {
    const sc = s.score >= 0 ? c.green(s.score.toFixed(2)) : c.red(s.score.toFixed(2));
    log(`     ${c.cyan(s.source.padEnd(15))} ${sc.padStart(5)} ${c.dim(`[${s.live ? "live" : "mock"}] ${s.note}`)}`);
  }
  const decision = await decide(bundle, ATHENA);
  log(c.bold(`\n  ② Decision: ${decision.direction} ${pct(decision.predictedBps)} @ conf ${decision.confidence} ${c.dim(`(${decision.model})`)}`));
  log(`     ${c.dim("↳ " + decision.rationale)}`);

  // 2) commit
  const ch = await commitDecision(roundId, agentId, decision);
  log(`\n  ③ ${c.green("Committed")} sealed prediction  ${c.dim(explorerTx(ch))}`);

  // 3) reveal
  await waitUntil(round.commitDeadline, "commit window to close");
  const rh = await revealDecision(roundId, agentId);
  log(`  ④ ${c.green("Revealed")} on-chain  ${c.dim(explorerTx(rh))}`);

  // 4) settle against a fresh real price
  await waitUntil(round.settleTime, "settlement time");
  const spot = (await spotPrice(cfg.asset)) ?? fromOraclePrice(round.entryPrice);
  log(c.dim(`  Reporting settlement price for ${cfg.asset}: $${spot}`));
  await reportPrice(cfg.asset, spot, "coingecko:settle");
  await sleep(1500);
  const sh = await settleRound(roundId);
  log(`  ⑤ ${c.green("Settled")}  ${c.dim(explorerTx(sh))}`);

  // 4b) copy-trade the verified champion on Merchant Moe (real Mantle DeFi)
  if (cfg.champion.tradeAmount > 0n && cfg.addresses.championVault) {
    try {
      const th = await executeChampionTrade(roundId, cfg.champion.tradeAmount, cfg.champion.minOut);
      log(`  ⑥ ${c.green("Champion copy-trade")} → real Merchant Moe swap  ${c.dim(explorerTx(th))}`);
    } catch (e: any) {
      log(c.dim(`     (champion trade skipped: ${e?.shortMessage || e?.message})`));
    }
  }

  // 5) report
  const [score, played, correct, accBps] = (await getAgentStats(agentId)) as readonly [bigint, number, number, number];
  hr("═");
  log(c.bold(c.cyan(`  ${cfg.agentName} reputation now:`)) + ` ${score >= 0n ? c.green("+" + score) : c.red(String(score))} pts · ${Number(accBps) / 100}% accuracy · ${played} rounds`);
  log(c.dim("  This is now a permanent, oracle-verified ERC-8004 record. Run again to compound it."));
  hr("═");
}

async function cmdRegister() {
  requireDeployed();
  const id = await registerAgent({ name: cfg.agentName, kind: "AI", model: cfg.llm.model });
  log(`Registered agent #${id}. Set AGENT_ID=${id} in .env`);
}

async function cmdReportPrice(args: string[]) {
  requireDeployed();
  const symbol = args[0] || cfg.asset;
  const price = args[1] ? Number(args[1]) : await spotPrice(symbol);
  if (!price) throw new Error(`No price for ${symbol}; pass one explicitly`);
  const h = await reportPrice(symbol, price, args[1] ? "manual" : "coingecko:spot");
  log(`Reported ${symbol} = $${price}  ${explorerTx(h)}`);
}

async function cmdOpenRound(args: string[]) {
  requireDeployed();
  const symbol = args[0] || cfg.asset;
  const title = args.slice(1).join(" ") || `${symbol} - arena`;
  const spot = (await spotPrice(symbol)) ?? 1;
  await reportPrice(symbol, spot, "coingecko:spot");
  await sleep(1500);
  const id = await openRound(symbol, title);
  log(`Opened round #${id} for ${symbol} (entry $${spot})`);
}

async function cmdSettle(args: string[]) {
  requireDeployed();
  const roundId = BigInt(args[0] ?? "0");
  if (roundId === 0n) throw new Error("usage: settle <roundId>");
  const symbol = cfg.asset;
  const spot = await spotPrice(symbol);
  if (spot) {
    await reportPrice(symbol, spot, "coingecko:settle");
    await sleep(1500);
  }
  const h = await settleRound(roundId);
  log(`Settled round #${roundId}  ${explorerTx(h)}`);
}

async function cmdChampion(args: string[]) {
  requireDeployed();
  const roundId = BigInt(args[0] ?? "0");
  if (roundId === 0n) throw new Error("usage: champion <roundId> [amountIn] [minOut]");
  const amountIn = BigInt(args[1] ?? cfg.champion.tradeAmount.toString());
  const minOut = BigInt(args[2] ?? cfg.champion.minOut.toString());
  if (amountIn === 0n) throw new Error("set CHAMPION_TRADE_AMOUNT in .env or pass amountIn");
  const h = await executeChampionTrade(roundId, amountIn, minOut);
  log(`Champion copy-trade for round #${roundId} on Merchant Moe: ${explorerTx(h)}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case "register":
      return cmdRegister();
    case "report-price":
      return cmdReportPrice(rest);
    case "open-round":
      return cmdOpenRound(rest);
    case "settle":
      return cmdSettle(rest);
    case "champion":
      return cmdChampion(rest);
    case "run":
    case undefined:
      return cmdRun();
    default:
      log(`Unknown command: ${cmd}. Use: run | register | report-price | open-round | settle | champion`);
  }
}

main().catch((e) => {
  console.error(c.red("✗ " + (e?.message || e)));
  process.exit(1);
});
