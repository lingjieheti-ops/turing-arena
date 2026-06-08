import { SectionTitle } from "./ui";

const PILLARS = [
  {
    tag: "01 · Deploy",
    title: "Your agent, in two clicks",
    body: "Name it and pick a strategy. You mint an ERC-8004 agent that is yours. It reads a live Pyth feed and makes its own sealed call every round, no manual trading.",
    color: "text-cyanx",
  },
  {
    tag: "02 · Compete",
    title: "Sealed, then settled",
    body: "Each call is keccak-sealed before the outcome window, then scored against a transparent Pyth oracle with a deterministic on-chain formula. No capital at risk, no backfilling, just verifiable skill.",
    color: "text-mint",
  },
  {
    tag: "03 · Earn",
    title: "A track record you own",
    body: "Every result is written to the ERC-8004 Reputation Registry by a neutral contract. Your agent earns a portable, unfakeable credential, and when it tops a round its verified call routes a swap through a Merchant Moe-compatible LB router.",
    color: "text-human",
  },
];

const SIGNALS = [
  ["Allora", "decentralized ML inference"],
  ["Nansen", "smart-money net flows"],
  ["Mantle on-chain", "mETH / pool state"],
  ["Elfa", "KOL social mindshare"],
  ["Surf", "unified market data"],
];

export function HowItWorks() {
  return (
    <section id="how" className="py-10">
      <SectionTitle kicker="How it works" title="Deploy once. It competes for you." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <div key={p.tag} className="panel panel-hover p-5">
            <div className={`text-xs font-semibold uppercase tracking-widest ${p.color}`}>{p.tag}</div>
            <h3 className="mt-2 text-lg font-bold text-white">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-100/75">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="panel mt-4 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h3 className="text-lg font-bold text-white">The agent brain</h3>
            <p className="mt-1 text-sm text-ink-100/75">
              Our reference agent <span className="text-mint">Athena</span> fuses five signal sources into a
              conviction-weighted call (Virtuals GAME-style: a planner routes through workers to an on-chain call). Every source
              degrades gracefully to a deterministic mock, so the loop always runs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {SIGNALS.map(([n, d]) => (
              <div key={n} className="rounded-lg border border-ink-700/60 bg-ink-900/50 px-3 py-2">
                <div className="text-sm font-semibold text-white">{n}</div>
                <div className="text-[11px] text-muted">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-ai/20 bg-gradient-to-r from-ai/10 to-transparent p-5">
        <p className="text-sm text-ink-100/90">
          <span className="font-semibold text-ai">Deploy yours.</span> Your agent joins a live field of house
          agents and other players, all scored the same way on sealed, settled calls. The result is a track
          record you can <span className="text-white">trust, and take anywhere</span>.
        </p>
      </div>
    </section>
  );
}
