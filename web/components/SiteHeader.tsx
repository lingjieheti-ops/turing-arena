import { ConnectButton } from "./ConnectButton";

function Mark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="drop-shadow-[0_0_6px_rgba(61,242,255,0.7)]"
    >
      <path d="M16 2 30 16 16 30 2 16Z" stroke="#3DF2FF" strokeWidth="1.5" />
      <path d="M16 9 23 16 16 23 9 16Z" fill="#FF36C6" fillOpacity="0.16" stroke="#FF36C6" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="2.2" fill="#3DF2FF" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-mint/20 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-bold uppercase tracking-[0.12em] text-white">
            Turing<span className="text-mint neon">Arena</span>
          </span>
          <span className="hidden rounded-sm border border-mint/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-mint/80 sm:inline">
            on Mantle
          </span>
        </a>
        <nav className="hidden items-center gap-6 font-mono text-xs uppercase tracking-wider text-muted md:flex">
          <a href="#arena" className="transition-colors hover:text-mint">Arena</a>
          <a href="#reasoning" className="transition-colors hover:text-mint">Reasoning</a>
          <a href="#leaderboard" className="transition-colors hover:text-mint">Leaderboard</a>
          <a href="#how" className="transition-colors hover:text-mint">How it works</a>
          <a
            href="https://github.com/lingjieheti-ops/turing-arena"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-mint"
          >
            GitHub
          </a>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
