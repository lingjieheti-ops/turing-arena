"use client";

import { useEffect, useState } from "react";
import { shortAddr } from "@turing-arena/shared";
import { type AgentUI, getLeaderboard } from "@/lib/arena";
import { isLive } from "@/lib/contracts";
import { ShareButton } from "./ShareButton";
import { KindTag, ScoreText, SectionTitle, Spinner } from "./ui";

const SAMPLE: AgentUI[] = [
  { agentId: 1n, name: "Athena", kind: "AI", model: "multi-signal fusion", owner: "0x0", score: 412n, played: 9, correct: 7, accuracyBps: 7778, repCount: 9 },
  { agentId: 2n, name: "Momentum Max", kind: "AI", model: "trend", owner: "0x0", score: 188n, played: 9, correct: 5, accuracyBps: 5556, repCount: 9 },
  { agentId: 3n, name: "HODLer Hank", kind: "HUMAN", model: "gut", owner: "0x0", score: 96n, played: 9, correct: 5, accuracyBps: 5556, repCount: 9 },
  { agentId: 4n, name: "Contrarian Cora", kind: "AI", model: "mean-reversion", owner: "0x0", score: -64n, played: 9, correct: 4, accuracyBps: 4444, repCount: 9 },
] as unknown as AgentUI[];

export function Leaderboard() {
  const [agents, setAgents] = useState<AgentUI[] | null>(null);
  const [demo, setDemo] = useState(!isLive());

  useEffect(() => {
    if (!isLive()) {
      setAgents(SAMPLE);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const data = await getLeaderboard();
        if (!alive) return;
        if (data.length === 0) {
          setAgents(SAMPLE);
          setDemo(true);
        } else {
          setAgents(data);
          setDemo(false);
        }
      } catch {
        if (alive) {
          setAgents(SAMPLE);
          setDemo(true);
        }
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const aiTotal = (agents ?? []).filter((a) => a.kind === "AI").reduce((s, a) => s + a.score, 0n);
  const humanTotal = (agents ?? []).filter((a) => a.kind === "HUMAN").reduce((s, a) => s + a.score, 0n);

  return (
    <section id="leaderboard" className="py-8">
      <SectionTitle
        kicker="Human vs AI"
        title="Verified-alpha leaderboard"
        right={
          <div className="flex items-center gap-3">
            {demo ? (
              <span className="badge border-human/40 bg-human/10 text-human">sample data</span>
            ) : (
              <span className="flex items-center gap-2 text-xs text-muted">
                <span className="h-1.5 w-1.5 animate-pulseglow rounded-full bg-mint" /> live · auto-refresh
              </span>
            )}
            <ShareButton />
          </div>
        }
      />
      {!demo && agents ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-ink-700/60 bg-ink-900/40 px-4 py-2.5 text-sm">
          <span className="text-xs uppercase tracking-[0.15em] text-muted">Can AI out-trade humans?</span>
          <span className="text-ai">
            🤖 AI{" "}
            <span className="stat-num">
              {aiTotal >= 0n ? "+" : ""}
              {aiTotal.toString()}
            </span>
          </span>
          <span className="text-muted">vs</span>
          <span className="text-human">
            🧑 Humans{" "}
            <span className="stat-num">
              {humanTotal >= 0n ? "+" : ""}
              {humanTotal.toString()}
            </span>
          </span>
          <span className="text-xs text-muted">net alpha, on the record</span>
        </div>
      ) : null}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[2.4rem_1fr_5rem_5rem_4rem] items-center gap-2 border-b border-ink-700/60 px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted sm:grid-cols-[2.4rem_1fr_6rem_6rem_5rem_6rem]">
          <div>#</div>
          <div>Agent</div>
          <div className="text-right">Alpha</div>
          <div className="text-right">Accuracy</div>
          <div className="hidden text-right sm:block">Rounds</div>
          <div className="text-right">Rep</div>
        </div>
        {!agents ? (
          <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted">
            <Spinner /> reading the chain…
          </div>
        ) : (
          agents.map((a, i) => (
            <div
              key={a.agentId.toString()}
              className="grid grid-cols-[2.4rem_1fr_5rem_5rem_4rem] items-center gap-2 border-b border-ink-800/60 px-4 py-3 last:border-0 hover:bg-ink-800/30 sm:grid-cols-[2.4rem_1fr_6rem_6rem_5rem_6rem]"
            >
              <div className={`stat-num text-sm ${i === 0 ? "text-human" : "text-muted"}`}>
                {i === 0 ? "①" : i + 1}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-white">{a.name}</span>
                  <KindTag kind={a.kind} />
                </div>
                <div className="truncate text-xs text-muted">
                  {a.model ?? "agent"} · {a.owner === "0x0" ? "—" : shortAddr(a.owner)}
                </div>
              </div>
              <div className="text-right">
                {a.played === 0 ? <span className="stat-num text-sm text-muted">—</span> : <ScoreText value={a.score} />}
              </div>
              <div className="stat-num text-right text-sm text-ink-100/80">
                {a.played === 0 ? "—" : `${(a.accuracyBps / 100).toFixed(0)}%`}
              </div>
              <div className="stat-num hidden text-right text-sm text-muted sm:block">{a.played}</div>
              <div className="text-right">
                {a.repCount === 0 ? (
                  <span className="stat-num text-sm text-muted">—</span>
                ) : (
                  <span className="stat-num text-sm text-mint" title="ERC-8004 reputation entries">
                    ×{a.repCount}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
