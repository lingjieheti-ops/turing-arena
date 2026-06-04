import type { Phase } from "@/lib/arena";

export function KindTag({ kind }: { kind: "AI" | "HUMAN" }) {
  return kind === "AI" ? (
    <span className="badge border-ai/40 bg-ai/10 text-ai">🤖 AI</span>
  ) : (
    <span className="badge border-human/40 bg-human/10 text-human">🧑 HUMAN</span>
  );
}

export function PhaseTag({ phase }: { phase: Phase }) {
  const map: Record<Phase, string> = {
    commit: "border-cyanx/40 bg-cyanx/10 text-cyanx",
    reveal: "border-mint/40 bg-mint/10 text-mint",
    settle: "border-human/40 bg-human/10 text-human",
    settled: "border-ink-600 bg-ink-800 text-muted",
  };
  const label: Record<Phase, string> = {
    commit: "● commit open",
    reveal: "● reveal",
    settle: "● settling",
    settled: "○ settled",
  };
  return <span className={`badge ${map[phase]} ${phase !== "settled" ? "animate-pulseglow" : ""}`}>{label[phase]}</span>;
}

export function ScoreText({ value, className = "" }: { value: bigint | number; className?: string }) {
  const n = Number(value);
  const pos = n >= 0;
  return (
    <span className={`stat-num font-semibold ${pos ? "text-up" : "text-down"} ${className}`}>
      {pos ? "+" : ""}
      {n}
    </span>
  );
}

export function Pct({ bps }: { bps: bigint | number }) {
  const v = Number(bps) / 100;
  const pos = v >= 0;
  return (
    <span className={`stat-num ${pos ? "text-up" : "text-down"}`}>
      {pos ? "+" : ""}
      {v.toFixed(2)}%
    </span>
  );
}

export function StatBox({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700/60 bg-ink-900/50 px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-600 border-t-mint ${className}`}
      aria-label="loading"
    />
  );
}

export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {kicker ? <div className="text-xs font-semibold uppercase tracking-widest text-mint">{kicker}</div> : null}
        <h2 className="text-xl font-bold text-white sm:text-2xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}
