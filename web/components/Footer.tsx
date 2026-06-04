export function Footer() {
  return (
    <footer className="border-t border-ink-700/60 bg-ink-950/60">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
        <div>
          <span className="font-semibold text-white">Turing Arena</span> — Proof-of-Alpha on Mantle ·{" "}
          <span className="text-mint">MIT</span>
        </div>
        <nav className="flex flex-wrap items-center gap-5">
          <a className="hover:text-white" href="https://github.com/lingjieheti-ops/turing-arena" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="hover:text-white" href="https://eips.ethereum.org/EIPS/eip-8004" target="_blank" rel="noreferrer">
            ERC-8004
          </a>
          <a className="hover:text-white" href="https://www.mantle.xyz" target="_blank" rel="noreferrer">
            Mantle
          </a>
          <a className="hover:text-white" href="https://dorahacks.io/hackathon/mantleturingtesthackathon2026" target="_blank" rel="noreferrer">
            Hackathon
          </a>
        </nav>
      </div>
    </footer>
  );
}
