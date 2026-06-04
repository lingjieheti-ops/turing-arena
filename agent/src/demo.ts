/**
 * Keyless demo: runs the full Human-vs-AI arena loop in memory using a
 * deterministic replay, with the EXACT on-chain scoring formula. No private key,
 * no RPC, no API keys required — `pnpm demo`. Pace it for a video with DEMO_DELAY=700.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Decision, type Signal, type SignalBundle, scoreAlpha } from "@turing-arena/shared";
import { decide } from "./brain";
import { banner, c, hr, log, pct } from "./logger";
import { CAST } from "./personas";

const here = dirname(fileURLToPath(import.meta.url));
const DELAY = Number(process.env.DEMO_DELAY || 0);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ReplayRound {
  asset: string;
  title: string;
  entryPrice: number;
  settlePrice: number;
  signals: Signal[];
}

interface Tally {
  name: string;
  kind: "AI" | "HUMAN";
  score: number;
  played: number;
  correct: number;
}

const arrow = (d: Decision["direction"]) => (d === "UP" ? c.green("▲ UP") : d === "DOWN" ? c.red("▼ DOWN") : c.gray("• FLAT"));
const tag = (k: "AI" | "HUMAN") => (k === "AI" ? c.magenta("[AI]") : c.yellow("[HUMAN]"));

async function main() {
  const replay = JSON.parse(readFileSync(resolve(here, "../demo/replay.json"), "utf8"));
  const rounds: ReplayRound[] = replay.rounds;

  banner("TURING ARENA — Proof-of-Alpha · keyless demo");
  log(
    c.dim(
      "  AI agents and a human publish commit-revealed calls; the realized move\n  is scored with the SAME formula the Mantle contract uses, then written to\n  ERC-8004 reputation. Watch the benchmark play out.\n",
    ),
  );

  const tally = new Map<string, Tally>();
  for (const p of CAST) tally.set(p.name, { name: p.name, kind: p.kind, score: 0, played: 0, correct: 0 });

  let r = 0;
  for (const round of rounds) {
    r++;
    const actualBps = Math.round(((round.settlePrice - round.entryPrice) / round.entryPrice) * 10000);
    const bundle: SignalBundle = { asset: round.asset, signals: round.signals, fetchedAt: 0 };

    hr("═");
    log(c.bold(`  ROUND ${r}/${rounds.length} — ${round.title}`));
    log(c.dim(`  entry $${round.entryPrice}  →  settles later`));
    hr();
    log(c.bold("  Signals on the tape:"));
    for (const s of bundle.signals) {
      const sc = s.score >= 0 ? c.green(s.score.toFixed(2)) : c.red(s.score.toFixed(2));
      log(`   ${c.cyan(s.source.padEnd(15))} ${sc.padStart(5)}  ${c.dim(s.note)}`);
    }
    await sleep(DELAY);

    // ---- COMMIT (sealed) ----
    hr();
    log(c.bold("  🔒 Commit phase — predictions are sealed (commit-reveal):"));
    const decisions = new Map<string, Decision>();
    for (const p of CAST) {
      const d = await decide(bundle, p);
      decisions.set(p.name, d);
      log(`   ${tag(p.kind)} ${p.name.padEnd(16)} ${c.gray("committed keccak(prediction) — nobody can see it yet")}`);
      await sleep(DELAY / 2);
    }

    // ---- REVEAL ----
    hr();
    log(c.bold("  🔓 Reveal phase — the calls, on the record:"));
    for (const p of CAST) {
      const d = decisions.get(p.name)!;
      log(
        `   ${tag(p.kind)} ${p.name.padEnd(16)} ${arrow(d.direction)}  ` +
          `${pct(d.predictedBps)} @ conf ${c.bold(String(d.confidence))}  ${c.dim(`(${d.model})`)}`,
      );
      log(`      ${c.dim("↳ " + d.rationale)}`);
    }
    await sleep(DELAY);

    // ---- SETTLE ----
    hr();
    log(c.bold(`  ⚖️  Settlement — realized move ${pct(actualBps)} (oracle)`));
    const results = CAST.map((p) => {
      const d = decisions.get(p.name)!;
      const { score, correct } = scoreAlpha(d.predictedBps, d.confidence, actualBps);
      const t = tally.get(p.name)!;
      t.score += score;
      t.played += 1;
      if (correct) t.correct += 1;
      return { p, d, score, correct };
    }).sort((a, b) => b.score - a.score);

    for (const { p, score, correct } of results) {
      const badge = correct ? c.green("✓") : c.red("✗");
      const sc = score >= 0 ? c.green(`+${score}`) : c.red(String(score));
      log(`   ${badge} ${tag(p.kind)} ${p.name.padEnd(16)} ${sc.padStart(6)} pts   ${c.dim("→ ERC-8004 reputation written")}`);
    }
    await sleep(DELAY);
  }

  // ---- FINAL LEADERBOARD ----
  const board = [...tally.values()].sort((a, b) => b.score - a.score);
  hr("═");
  log(c.bold(c.cyan("  🏆 FINAL LEADERBOARD (cumulative verified alpha)")));
  hr();
  board.forEach((t, i) => {
    const rank = i === 0 ? c.yellow("①") : c.gray(`${i + 1}.`);
    const acc = t.played ? Math.round((t.correct / t.played) * 100) : 0;
    const sc = t.score >= 0 ? c.green(`+${t.score}`) : c.red(String(t.score));
    log(`   ${rank} ${tag(t.kind)} ${t.name.padEnd(16)} ${sc.padStart(6)} pts   ${c.dim(`${acc}% accuracy · ${t.played} rounds`)}`);
  });

  const bestAI = board.filter((t) => t.kind === "AI")[0];
  const bestHuman = board.filter((t) => t.kind === "HUMAN")[0];
  hr();
  if (bestAI && bestHuman) {
    if (bestAI.score > bestHuman.score) {
      log(`  ${c.magenta("AI wins the Turing Test")}: ${c.bold(bestAI.name)} (${bestAI.score}) beat the best human ${bestHuman.name} (${bestHuman.score}).`);
    } else {
      log(`  ${c.yellow("Human holds the line")}: ${c.bold(bestHuman.name)} (${bestHuman.score}) edged the best AI ${bestAI.name} (${bestAI.score}).`);
    }
  }
  hr("═");
  log(
    c.dim(
      "  Every commit, reveal and score above is exactly what the Mantle contract\n  records on-chain. Deploy + run it for real:  pnpm contracts:deploy:sepolia  →  pnpm agent\n",
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
