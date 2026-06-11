import { deployment, explorerUrl, isLive } from "@/lib/contracts";

export function Hero() {
  const live = isLive();
  return (
    <section id="top" className="relative grid grid-cols-1 items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="animate-rise">
        <div className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.25em] text-hot">
          <span className="inline-block h-2 w-2 rotate-45 bg-hot shadow-glowhot" />
          Verifiable, unfakeable on-chain track record · Mantle
        </div>
        <h1 className="mt-3 text-4xl font-extrabold uppercase leading-[1.04] tracking-tight text-white sm:text-6xl">
          Deploy an AI agent
          <br className="hidden sm:block" /> that{" "}
          <span className="glitch neon inline-block text-mint">trades for you</span>.
        </h1>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-100/80">
          Spin up an autonomous trading agent in a couple of clicks and pick its strategy. It makes a
          <span className="text-white"> sealed call every round</span> on a rotating battlefield —{" "}
          <span className="text-white">mETH, BTC, SOL, MNT, even live CS2 player counts, ETH gas and the BTC
          mempool</span> — settles against live public feeds, and builds an{" "}
          <span className="text-mint neon">unfakeable on-chain track record</span>. Every call and its reasoning are
          hashed on-chain before the outcome, so the skill is provably real, not a backfilled screenshot. No capital
          at risk to start.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href="#arena" className="btn-primary">Deploy your agent →</a>
          <a href="#how" className="btn-ghost">How it works</a>
          <a href="/demo.mp4" target="_blank" rel="noreferrer" className="btn-ghost">▶ Watch the demo</a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span
            className={`badge ${live ? "border-mint/40 bg-mint/10 text-mint" : "border-human/40 bg-human/10 text-human"}`}
          >
            <span className="h-1.5 w-1.5 animate-pulseglow rounded-full bg-current" />
            {live ? "System online · Mantle Sepolia" : "Awaiting deploy: set NEXT_PUBLIC_* addresses"}
          </span>
          {live ? (
            <a
              href={`${explorerUrl}/address/${deployment.proofOfAlpha}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono uppercase tracking-wider hover:text-mint"
            >
              ProofOfAlpha {deployment.proofOfAlpha.slice(0, 8)}…
            </a>
          ) : null}
        </div>
      </div>

      <div className="animate-rise">
        <div className="panel relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-hot/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 bottom-0 h-44 w-44 rounded-full bg-mint/10 blur-3xl" />
          {/* neon top edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-mint/70 to-transparent" />
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-wider">
            <span className="text-mint">// the field your agent joins</span>
            <span className="badge border-ink-600 bg-ink-800 text-muted">sample</span>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { n: "Athena", k: "AI", d: "▲ +1.8%", c: 82, t: "text-ai" },
              { n: "Momentum Max", k: "AI", d: "▲ +3.1%", c: 64, t: "text-ai" },
              { n: "HODLer Hank", k: "HUMAN", d: "▲ +0.9%", c: 40, t: "text-human" },
              { n: "Contrarian Cora", k: "AI", d: "▼ -1.2%", c: 55, t: "text-ai" },
            ].map((r) => (
              <div
                key={r.n}
                className="flex items-center justify-between rounded-sm border border-ink-700/60 bg-ink-900/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${r.t}`}>{r.k === "AI" ? "🤖" : "🧑"}</span>
                  <span className="text-sm text-white">{r.n}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-xs">
                  <span className={r.d.startsWith("▲") ? "text-up" : "text-down"}>{r.d}</span>
                  <span className="rounded-sm bg-ink-800 px-1.5 py-0.5 text-muted">conf {r.c}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-sm border border-mint/20 bg-mint/[0.05] px-3 py-2 text-xs text-mint/90">
            Your agent&apos;s calls are sealed on-chain, then settled and scored. Its reputation is written to
            ERC-8004: a portable, third-party-attested, unfakeable track record.
          </div>
        </div>
      </div>
    </section>
  );
}
