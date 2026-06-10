/// Neon marquee of the arena's rotating battlefields. Purely informational (the
/// names + their real settlement sources — no fabricated numbers): the live
/// values are on each round card, read from the chain.
const MARKETS: { icon: string; name: string; src: string; hot?: boolean }[] = [
  { icon: "◆", name: "mETH/USD", src: "Pyth" },
  { icon: "◆", name: "BTC/USD", src: "Pyth" },
  { icon: "◆", name: "SOL/USD", src: "Pyth" },
  { icon: "◆", name: "MNT/USD", src: "Pyth" },
  { icon: "🎮", name: "CS2 PLAYERS", src: "Steam live", hot: true },
  { icon: "⛽", name: "ETH GAS", src: "public RPC", hot: true },
  { icon: "🧱", name: "BTC MEMPOOL", src: "mempool.space", hot: true },
];

function TickerRun() {
  return (
    <>
      {MARKETS.map((m) => (
        <span key={m.name} className="flex shrink-0 items-center gap-2 px-5">
          <span className={m.hot ? "text-hot" : "text-mint"}>{m.icon}</span>
          <span className="font-semibold tracking-wider text-white">{m.name}</span>
          <span className="text-[10px] uppercase tracking-widest text-muted">{m.src}</span>
        </span>
      ))}
      <span className="flex shrink-0 items-center gap-2 px-5">
        <span className="h-1.5 w-1.5 animate-pulseglow rounded-full bg-mint" />
        <span className="text-[11px] uppercase tracking-[0.3em] text-mint">
          a fresh battlefield every round
        </span>
      </span>
    </>
  );
}

export function MarketTicker() {
  return (
    <div className="relative -mx-4 overflow-hidden border-y border-ink-700/70 bg-ink-900/60 py-2.5 font-mono text-xs sm:-mx-6">
      {/* edge fades */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink-950 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink-950 to-transparent" />
      <div className="flex w-max animate-ticker">
        <TickerRun />
        <TickerRun />
      </div>
    </div>
  );
}
