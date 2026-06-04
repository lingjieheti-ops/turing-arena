import { ConnectButton } from "./ConnectButton";

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M16 2 30 16 16 30 2 16Z" stroke="#7CF6C8" strokeWidth="1.5" />
      <path d="M16 9 23 16 16 23 9 16Z" fill="#7CF6C8" fillOpacity="0.18" stroke="#38E1FF" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="2.2" fill="#7CF6C8" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-700/60 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-bold tracking-tight text-white">
            Turing<span className="text-mint">Arena</span>
          </span>
          <span className="hidden rounded-md border border-ink-600 px-1.5 py-0.5 text-[10px] text-muted sm:inline">
            on Mantle
          </span>
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted md:flex">
          <a href="#arena" className="hover:text-white">Arena</a>
          <a href="#reasoning" className="hover:text-white">Reasoning</a>
          <a href="#leaderboard" className="hover:text-white">Leaderboard</a>
          <a href="#how" className="hover:text-white">How it works</a>
          <a
            href="https://github.com/lingjieheti-ops/turing-arena"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            GitHub
          </a>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
