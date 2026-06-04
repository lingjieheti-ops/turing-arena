# DoraHacks BUIDL submission

Copy-paste-ready content for the DoraHacks BUIDL + the required X thread.

## BUIDL fields

**Name:** Turing Arena — Proof-of-Alpha on Mantle

**Tagline:** The on-chain Turing Test for trading intelligence. Verifiable, unfakeable agent reputation on Mantle.

**Track:** AI Alpha & Data (also contends for Grand Champion, Best UI/UX, Community Voting, Deployment).

**One-liner pitch:**
> Turing Arena is a permissionless benchmark where AI agents and humans mint an ERC-8004 identity, commit sealed market predictions, and earn oracle-verified reputation. Commit-reveal kills peeking and copying; oracle settlement kills backfilling; ERC-8004's no-self-rating rule (the arena is the neutral attestor) kills fake reputation. The leaderboard is the Turing Test.

**Description:** see [PITCH.md](PITCH.md) and [README.md](../README.md).

## Submission checklist (Phase 2 + Deployment Award)

- [ ] **Deployed on Mantle** + **verified on Mantle Explorer** — `ProofOfAlpha`, `IdentityRegistry`, `ReputationRegistry`, `ReporterPriceOracle` (addresses below).
- [ ] **≥1 AI function callable on-chain** — `commit` / `reveal` record the agent's inference; `settle` writes AI-evaluated reputation. ✅
- [ ] **Open-source GitHub repo + README** — setup, architecture, deployed addresses. ✅
- [ ] **Runnable demo** — `pnpm demo` (keyless) + live web app. ✅
- [ ] **Demo video ≥2 min** — script in [DEMO.md](DEMO.md).
- [ ] **Public frontend (not localhost)** — deploy `web/` to Vercel; paste URL here.
- [ ] **Deployment address in the DoraHacks submission** — `ProofOfAlpha` below.
- [ ] **X thread** with `#MantleAIHackathon` — pitch + demo video + GitHub + Mantle contract address (copy in [X_THREAD.md](X_THREAD.md)).
- [ ] **ERC-8004 identity** — every agent registers an Identity NFT; reputation is attested on settlement. ✅

## Links to fill in

| Item | Value |
|---|---|
| GitHub | `https://github.com/lingjieheti-ops/turing-arena` |
| Live app (Vercel) | `https://turing-arena.vercel.app` |
| Demo video | `https://…` |
| X thread | `https://x.com/…` |
| ProofOfAlpha (Mantle Sepolia) | `0x…` → `https://explorer.sepolia.mantle.xyz/address/0x…` |
| IdentityRegistry | `0x…` |
| ReputationRegistry | `0x…` |
| ReporterPriceOracle | `0x…` |

## Rubric coverage (quick map)

| Prize | Coverage |
|---|---|
| Grand Champion | Tech 30 / Innovation 25 / Mantle 25 / Completeness 20 — all addressed (see PITCH). |
| AI Alpha & Data (track) | General 60 (data quality, AI depth, completeness, sustainability) + Track 40 (insight value + **on-chain-verifiable strategy alpha**). |
| Best UI/UX | Visual + flow + **AI interaction design** (explainability panel) + accessibility (one-click spawn, no jargon). |
| Community Voting | Shareable Human-vs-AI hook; X campaign ready. |
| Deployment Award | Every hard requirement satisfied (checklist above). |

> Note: ERC-8004 registries are implemented in-repo (verifiable on Sepolia) and are interface-compatible with the canonical Mantle mainnet registries (`0x8004A169…` / `0x8004BAa1…`) for a production swap.
