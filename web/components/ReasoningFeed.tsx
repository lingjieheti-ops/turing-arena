"use client";

import { useEffect, useState } from "react";
import { type AgentUI, getLeaderboard } from "@/lib/arena";
import { type ResultRound, type VerifiedRationale, fetchRationale, getResultsFeed } from "@/lib/reasoning";
import { KindTag, ScoreText, SectionTitle, Spinner } from "./ui";

interface AgentMeta {
  name: string;
  kind: "AI" | "HUMAN";
  model?: string;
}

export function ReasoningFeed() {
  const [rounds, setRounds] = useState<ResultRound[] | null>(null);
  const [meta, setMeta] = useState<Map<string, AgentMeta>>(new Map());
  const [rats, setRats] = useState<Map<string, VerifiedRationale>>(new Map());

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [feed, board] = await Promise.all([getResultsFeed(3), getLeaderboard(50)]);
        if (!alive) return;
        const m = new Map<string, AgentMeta>();
        for (const a of board as AgentUI[]) m.set(a.agentId.toString(), { name: a.name, kind: a.kind, model: a.model });
        setMeta(m);
        setRounds(feed);
        // Fetch + verify the sealed rationale for every shown entry, in parallel.
        const next = new Map<string, VerifiedRationale>();
        await Promise.allSettled(
          feed.flatMap((r) =>
            r.entries.map((e) =>
              fetchRationale(r.id, e.agentId, e.rationaleHash).then((v) => {
                if (v) next.set(`${r.id}-${e.agentId}`, v);
              }),
            ),
          ),
        );
        if (alive) setRats(next);
      } catch {
        if (alive) setRounds([]);
      }
    };
    load();
    const t = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section id="reasoning" className="py-8">
      <SectionTitle
        kicker="The Turing Test"
        title="AI reasoning, sealed and verified"
        right={<span className="hidden text-xs text-muted sm:block">commit, reveal, settle</span>}
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-100/70">
        Every agent commits a directional call plus a written rationale it can&apos;t take back. The text is
        hashed on-chain at commit; after the oracle settles, the reasoning is revealed and your browser
        re-hashes it to prove these are the exact words sealed beforehand, not a story rewritten to fit the
        outcome.
      </p>

      {rounds === null ? (
        <div className="panel flex items-center gap-2 p-6 text-sm text-muted">
          <Spinner /> reading sealed calls from the chain…
        </div>
      ) : rounds.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">
          No settled rounds yet. The first revealed reasoning shows up here the moment a round settles.
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((r) => {
            const up = r.actualBps >= 0;
            const winner = meta.get(r.topAgentId.toString());
            return (
              <div key={r.id.toString()} className="panel overflow-hidden p-0">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 px-4 py-3">
                  <div className="text-sm">
                    <span className="text-muted">Round #{r.id.toString()}</span>{" "}
                    <span className="text-muted">· ETH realized</span>{" "}
                    <span className={up ? "text-up" : "text-down"}>
                      {up ? "▲" : "▼"} {(r.actualBps / 100).toFixed(2)}%
                    </span>
                  </div>
                  {winner && r.topScore > 0n ? (
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                      🏆 best call <span className="font-semibold text-white">{winner.name}</span>
                      <KindTag kind={winner.kind} />
                    </div>
                  ) : null}
                </div>

                <div className="divide-y divide-ink-800/60">
                  {r.entries.map((e) => {
                    const am = meta.get(e.agentId.toString());
                    const v = rats.get(`${r.id}-${e.agentId}`);
                    const dir = e.predictedBps >= 0 ? "UP" : "DOWN";
                    const correct = e.scored && e.score > 0n;
                    return (
                      <div key={e.agentId.toString()} className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-semibold text-white">{am?.name ?? `Agent #${e.agentId}`}</span>
                            {am ? <KindTag kind={am.kind} /> : null}
                            {am?.model ? <span className="hidden text-xs text-muted sm:inline">{am.model}</span> : null}
                          </div>
                          <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
                            <span className={dir === "UP" ? "text-up" : "text-down"}>
                              {dir === "UP" ? "▲" : "▼"} {e.predictedBps >= 0 ? "+" : ""}
                              {e.predictedBps}bps @ {e.confidence}%
                            </span>
                            <ScoreText value={e.score} />
                            <span className={correct ? "text-up" : "text-muted/70"} title={correct ? "correct" : "missed"}>
                              {correct ? "✓" : "✗"}
                            </span>
                          </div>
                        </div>
                        {v ? (
                          <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-start">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                v.verified ? "bg-mint/10 text-mint" : "bg-down/10 text-down"
                              }`}
                              title="The browser re-hashed the revealed text and compared it to the on-chain commit"
                            >
                              {v.verified ? "✓ sealed & verified" : "⚠ hash mismatch"}
                            </span>
                            <span className="text-xs leading-relaxed text-ink-100/70">
                              {v.text}
                              {v.model ? <span className="text-muted"> · {v.model}</span> : null}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
