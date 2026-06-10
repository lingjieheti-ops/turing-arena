"use client";

import { useEffect, useRef, useState } from "react";
import { shortAddr } from "@turing-arena/shared";
import { type AgentUI, getLeaderboard } from "@/lib/arena";
import { isLive } from "@/lib/contracts";
import { type Stance, getLatestStances } from "@/lib/reasoning";
import { AgentAvatar } from "./AgentAvatar";
import { AgentHover } from "./AgentHover";
import { BattleCardButton } from "./BattleCard";
import { GrudgeMatches } from "./GrudgeMatches";
import { ShareButton } from "./ShareButton";
import { KindTag, ScoreText, SectionTitle, Spinner } from "./ui";

const SAMPLE: AgentUI[] = [
  { agentId: 1n, name: "Athena", kind: "AI", model: "multi-signal fusion", owner: "0x0", score: 412n, played: 9, correct: 7, accuracyBps: 7778, repCount: 9 },
  { agentId: 2n, name: "Momentum Max", kind: "AI", model: "trend", owner: "0x0", score: 188n, played: 9, correct: 5, accuracyBps: 5556, repCount: 9 },
  { agentId: 3n, name: "HODLer Hank", kind: "HUMAN", model: "gut", owner: "0x0", score: 96n, played: 9, correct: 5, accuracyBps: 5556, repCount: 9 },
  { agentId: 4n, name: "Contrarian Cora", kind: "AI", model: "mean-reversion", owner: "0x0", score: -64n, played: 9, correct: 4, accuracyBps: 4444, repCount: 9 },
] as unknown as AgentUI[];

/// A quick, fun "form" tag derived from the agent's own verified record.
function formBadge(a: AgentUI): { icon: string; title: string } | null {
  if (a.played === 0) return null;
  if (a.accuracyBps >= 5500 && a.score > 0n) return { icon: "🔥", title: "on a hot streak" };
  if (a.score < 0n) return { icon: "🧊", title: "ice cold" };
  return null;
}

export function Leaderboard() {
  const [agents, setAgents] = useState<AgentUI[] | null>(null);
  const [demo, setDemo] = useState(!isLive());
  // Once we've shown real on-chain data, a transient RPC choke must NOT drop the
  // board back to sample data — keep the last good standings and retry.
  const everReal = useRef(false);
  // The fullest board we've rendered. A later RPC-choked (partial) read must not
  // drop agents we've already shown, so we never regress below this count.
  const bestCount = useRef(0);
  // Each agent's latest sealed call → the hover card's "current mood".
  const [stances, setStances] = useState<Map<string, Stance>>(new Map());

  useEffect(() => {
    if (!isLive()) return;
    let alive = true;
    const load = () =>
      getLatestStances()
        .then((s) => {
          if (alive && s.size) setStances(s);
        })
        .catch(() => {});
    // Stagger the first read so the mood pass doesn't pile onto the cold-load
    // RPC burst (leaderboard + active round + feed all hitting at t=0).
    const first = setTimeout(load, 1100);
    const t = setInterval(load, 30000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

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
          if (!everReal.current) {
            setAgents(SAMPLE);
            setDemo(true);
          }
        } else {
          everReal.current = true;
          setDemo(false);
          // Adopt the read only if it's at least as complete as the best we've
          // shown; a partial read keeps the fuller board rather than dropping rows.
          if (data.length >= bestCount.current) {
            bestCount.current = data.length;
            setAgents(data);
          }
        }
      } catch {
        if (alive && !everReal.current) {
          setAgents(SAMPLE);
          setDemo(true);
        }
      }
    };
    const first = setTimeout(load, 300);
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  return (
    <section id="leaderboard" className="py-8">
      <SectionTitle
        kicker="The field"
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
            {agents && agents.length > 0 ? <BattleCardButton agents={agents} /> : null}
            <ShareButton />
          </div>
        }
      />
      {!demo && agents ? (
        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-ink-700/60 bg-ink-900/40 px-4 py-2.5 text-sm">
          <span className="text-xs uppercase tracking-[0.15em] text-muted">Every rank is earned</span>
          <span className="text-ink-100/80">
            from sealed, settled calls. <span className="text-mint">Deploy your agent</span> and climb.
          </span>
        </div>
      ) : null}
      {agents && agents.length > 0 ? <GrudgeMatches agents={agents} /> : null}
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
              className={`grid grid-cols-[2.4rem_1fr_5rem_5rem_4rem] items-center gap-2 border-b border-ink-800/60 px-4 py-3 last:border-0 hover:bg-ink-800/30 sm:grid-cols-[2.4rem_1fr_6rem_6rem_5rem_6rem] ${
                i === 0 ? "bg-gradient-to-r from-human/[0.07] to-transparent" : ""
              }`}
            >
              <div
                className={`stat-num text-sm ${
                  i === 0
                    ? "text-human drop-shadow-[0_0_7px_rgba(255,197,61,0.9)]"
                    : i === 1
                      ? "text-mint drop-shadow-[0_0_6px_rgba(61,242,255,0.7)]"
                      : i === 2
                        ? "text-hot drop-shadow-[0_0_6px_rgba(255,54,198,0.7)]"
                        : "text-muted"
                }`}
              >
                {i === 0 ? "①" : i + 1}
              </div>
              <AgentHover
                name={a.name}
                model={a.model}
                kind={a.kind}
                avatar={a.avatar}
                blurb={a.blurb}
                mood={stances.get(a.agentId.toString())}
                className="flex min-w-0 cursor-help items-center gap-2.5"
              >
                <AgentAvatar name={a.name} avatar={a.avatar} size={34} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-white">{a.name}</span>
                    <KindTag kind={a.kind} />
                    {formBadge(a) ? (
                      <span className="shrink-0 text-xs leading-none" title={formBadge(a)!.title}>
                        {formBadge(a)!.icon}
                      </span>
                    ) : null}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {a.model ?? "agent"} · {a.owner === "0x0" ? "—" : shortAddr(a.owner)}
                  </div>
                </div>
              </AgentHover>
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
