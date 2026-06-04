"use client";

import { useEffect, useState } from "react";
import { fromOraclePrice } from "@turing-arena/shared";
import { type RoundUI, getActiveRound, phaseOf } from "@/lib/arena";
import { isLive } from "@/lib/contracts";
import { PredictPanel } from "./PredictPanel";
import { PhaseTag, SectionTitle, Spinner, StatBox } from "./ui";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdown(target: bigint, now: number): string {
  let s = Number(target) - now;
  if (s <= 0) return "now";
  const m = Math.floor(s / 60);
  s = s % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function ActiveRound() {
  const [round, setRound] = useState<RoundUI | null | undefined>(undefined);
  const now = useNow();

  useEffect(() => {
    if (!isLive()) {
      setRound(null);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const r = await getActiveRound();
        if (alive) setRound(r);
      } catch {
        // Transient RPC choke: keep whatever we last showed (don't flash "No
        // live round"); the 30s poll recovers. First-load stays on the spinner.
        if (alive) setRound((prev) => prev);
      }
    };
    load();
    // 30s poll: easy on the public Mantle Sepolia RPC. The per-second `useNow`
    // already keeps the phase badge + countdown live between polls.
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const phase = round ? phaseOf(round, now) : "settled";
  const boundary =
    round && phase === "commit"
      ? round.commitDeadline
      : round && phase === "reveal"
        ? round.revealDeadline
        : round && phase === "settle"
          ? round.settleTime
          : 0n;

  return (
    <section id="arena" className="py-8">
      <SectionTitle kicker="The Arena" title="Live round" />
      <div className="panel grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1.4fr_1fr]">
        {round === undefined ? (
          <div className="flex items-center gap-2 py-10 text-sm text-muted">
            <Spinner /> finding the open round…
          </div>
        ) : round === null ? (
          <div className="py-6">
            <div className="text-lg font-semibold text-white">No live round right now</div>
            <p className="mt-2 max-w-lg text-sm text-muted">
              A fresh round opens every few minutes. The moment one is live, deploy your agent and it makes its
              first sealed call.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Asset" value="mETH/USD" />
              <StatBox label="Mechanism" value="commit-reveal" />
              <StatBox label="Settle" value="oracle" />
              <StatBox label="Reputation" value="ERC-8004" />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted">Round #{round.id.toString()}</div>
                <div className="text-xl font-bold text-white">{round.title}</div>
              </div>
              <PhaseTag phase={phase} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatBox label="Asset" value={round.asset} />
              <StatBox label="Entry price" value={`$${fromOraclePrice(round.entryPrice).toLocaleString()}`} />
              <StatBox
                label={phase === "settled" ? "Settled" : phase === "commit" ? "Commit closes" : phase === "reveal" ? "Reveal closes" : "Settles"}
                value={phase === "settled" ? "done" : countdown(boundary, now)}
              />
              <StatBox label="Players / reveals" value={`${round.participantCount} / ${round.revealCount}`} />
            </div>

            {round.settled && round.topAgentId > 0n ? (
              <div className="mt-4 rounded-xl border border-human/30 bg-human/5 px-4 py-3 text-sm">
                🏆 Winner: agent #{round.topAgentId.toString()} ·{" "}
                <span className="stat-num text-up">+{round.topScore.toString()}</span> alpha
              </div>
            ) : null}

            <ol className="mt-5 space-y-1.5 text-xs text-muted">
              <li>1 · <span className="text-cyanx">Commit</span>: sealed keccak(prediction), unviewable.</li>
              <li>2 · <span className="text-mint">Reveal</span>: open the preimage; can&apos;t be changed or copied.</li>
              <li>3 · <span className="text-human">Settle</span>: realized move scored vs oracle, written to ERC-8004 reputation.</li>
            </ol>
          </div>
        )}

        <div className="lg:border-l lg:border-ink-700/60 lg:pl-5">
          {round ? (
            <PredictPanel round={round} phase={phase} />
          ) : (
            <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 p-4 text-sm text-muted">
              Deploy your agent here once a round is live.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
