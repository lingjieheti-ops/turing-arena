"use client";

import type { AgentUI } from "@/lib/arena";
import { LORE } from "@/lib/lore";
import { AgentAvatar } from "./AgentAvatar";

/// Mutual rivalries pulled from the house-agent lore (A names B AND B names A),
/// so the celebrity feuds — Saylor vs Schiff, Buffett vs Cathie Wood, trend vs
/// contrarian — can be scored live and head-to-head straight off the on-chain
/// leaderboard. Pure cosmetic framing layered on real, verified scores.
function mutualPairs(): [string, string][] {
  const pairs: [string, string][] = [];
  const seen = new Set<string>();
  for (const [name, lore] of Object.entries(LORE)) {
    const rival = lore.rival;
    if (!rival || !LORE[rival] || LORE[rival].rival !== name) continue;
    const key = [name, rival].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([name, rival]);
  }
  return pairs;
}

function Side({ a, leads }: { a: AgentUI; leads: boolean }) {
  const pos = a.score >= 0n;
  return (
    <div className={`flex min-w-0 flex-1 flex-col items-center gap-1 ${leads ? "" : "opacity-55"}`}>
      <div className="relative">
        <AgentAvatar name={a.name} avatar={a.avatar} size={30} />
        {leads ? <span className="absolute -right-1.5 -top-2 text-[11px] leading-none">👑</span> : null}
      </div>
      <div className="max-w-[5.5rem] truncate text-center text-[11px] font-semibold text-white">{a.name}</div>
      <div className={`stat-num text-xs ${pos ? "text-up" : "text-down"}`}>
        {pos ? "+" : ""}
        {a.score.toString()}
      </div>
    </div>
  );
}

export function GrudgeMatches({ agents }: { agents: AgentUI[] }) {
  const byName = new Map(agents.map((a) => [a.name, a]));
  const matches = mutualPairs()
    .map(([x, y]) => ({ a: byName.get(x), b: byName.get(y) }))
    .filter((m): m is { a: AgentUI; b: AgentUI } => !!m.a && !!m.b && (m.a.played > 0 || m.b.played > 0))
    // Closest / most-active feuds first.
    .sort((m, n) => n.a.played + n.b.played - (m.a.played + m.b.played));

  if (matches.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-ink-700/60 bg-ink-900/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.15em] text-mint">⚔ Grudge matches</span>
        <span className="text-muted">celebrity feuds, scored live on-chain</span>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {matches.map(({ a, b }) => {
          const aLeads = a.score >= b.score;
          return (
            <div
              key={`${a.name}|${b.name}`}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-ink-800/70 bg-ink-950/40 px-3 py-2"
              style={{ minWidth: "11.5rem" }}
            >
              <Side a={a} leads={aLeads} />
              <span className="shrink-0 text-[10px] font-bold text-muted/70">VS</span>
              <Side a={b} leads={!aLeads} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
