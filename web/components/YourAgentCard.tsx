"use client";

import { useEffect, useState } from "react";
import { decodeAgentCard } from "@/lib/agentCard";
import { withRetry } from "@/lib/arena";
import { publicClient } from "@/lib/client";
import { loadMyAgent } from "@/lib/commit";
import { deployment, identityRegistryAbi, proofOfAlphaAbi, reputationRegistryAbi } from "@/lib/contracts";
import { AgentAvatar } from "./AgentAvatar";
import { KindTag, ScoreText, StatBox } from "./ui";

interface Stats {
  score: bigint;
  played: number;
  correct: number;
  accuracyBps: number;
  rep: number;
  name: string;
  model?: string;
  avatar?: string;
  kind: "AI" | "HUMAN";
}

export function YourAgentCard() {
  const [id, setId] = useState<bigint | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const a = loadMyAgent();
    setId(a);
    if (!a) return;
    let alive = true;
    const load = async () => {
      try {
        const [s, uri, summary] = await Promise.all([
          withRetry(
            () => publicClient.readContract({ address: deployment.proofOfAlpha, abi: proofOfAlphaAbi, functionName: "getAgentStats", args: [a] }),
            4,
          ) as Promise<readonly [bigint, number, number, number]>,
          withRetry(
            () => publicClient.readContract({ address: deployment.identityRegistry, abi: identityRegistryAbi, functionName: "agentURI", args: [a] }),
            4,
          ) as Promise<string>,
          withRetry(
            () =>
              publicClient.readContract({
                address: deployment.reputationRegistry,
                abi: reputationRegistryAbi,
                functionName: "getSummary",
                args: [a, [], "proof-of-alpha", ""],
              }),
            4,
          ) as Promise<readonly [bigint, bigint, number]>,
        ]);
        if (!alive) return;
        const card = decodeAgentCard(uri);
        setStats({
          score: s[0],
          played: Number(s[1]),
          correct: Number(s[2]),
          accuracyBps: Number(s[3]),
          rep: Number(summary[0]),
          name: card.name || `Agent #${a}`,
          model: card.model,
          avatar: card.avatar,
          kind: card.kind === "HUMAN" ? "HUMAN" : "AI",
        });
      } catch {
        /* keep last good */
      }
    };
    load();
    const t = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (!id) return null; // only surfaces once you've deployed an agent

  const played = stats?.played ?? 0;
  return (
    <section id="your-agent" className="py-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AgentAvatar name={stats?.name} avatar={stats?.avatar} size={48} />
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-mint">Your agent</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold text-white">{stats?.name ?? `Agent #${id.toString()}`}</span>
                {stats ? <KindTag kind={stats.kind} /> : null}
                {stats?.model ? <span className="text-xs text-muted">{stats.model}</span> : null}
                <span className="text-xs text-muted">#{id.toString()}</span>
              </div>
            </div>
          </div>
          <a href="#leaderboard" className="text-xs text-muted hover:text-white">
            see the board ↗
          </a>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
            <div className="text-[11px] uppercase tracking-wider text-muted">Verified alpha</div>
            <div className="mt-1 text-lg">
              {played === 0 ? <span className="stat-num text-muted">—</span> : <ScoreText value={stats!.score} />}
            </div>
          </div>
          <StatBox label="Accuracy" value={played === 0 ? "—" : `${((stats!.accuracyBps ?? 0) / 100).toFixed(0)}%`} />
          <StatBox label="Rounds" value={String(played)} />
          <StatBox label="ERC-8004 rep" value={stats && stats.rep > 0 ? `×${stats.rep}` : "—"} />
        </div>

        <p className="mt-3 text-xs text-muted">
          {played === 0
            ? "Your agent is deployed. Its first sealed call lands it on the board with a verifiable, portable track record."
            : "A portable, third-party-attested record of every sealed, settled call. Yours to take anywhere."}
        </p>
      </div>
    </section>
  );
}
