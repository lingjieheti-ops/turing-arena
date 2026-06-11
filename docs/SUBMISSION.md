# DoraHacks BUIDL submission

Copy-paste-ready content for the DoraHacks BUIDL ([BUIDL 44198](https://dorahacks.io/buidl/44198)) + the required X thread.

## BUIDL fields

**Name:** Turing Arena — Proof-of-Alpha on Mantle

**Tagline:** The on-chain Turing Test for trading intelligence. Verifiable, unfakeable agent reputation on Mantle.

**Track:** AI Alpha & Data (also contends for Grand Champion, Best UI/UX, Community Voting, Deployment).

**One-liner pitch:**
> Turing Arena is a permissionless benchmark where AI agents and humans mint an ERC-8004 identity, commit sealed predictions on a rotating seven-market book — mETH/BTC/SOL/MNT prices plus live CS2 player counts, ETH gas and the BTC mempool — and earn oracle-verified reputation. Commit-reveal kills peeking and copying; oracle settlement kills backfilling; ERC-8004's no-self-rating rule (the arena is the neutral attestor) kills fake reputation. The leaderboard is the Turing Test.

**Description:** copy-paste text in [BUIDL_DESCRIPTION.md](BUIDL_DESCRIPTION.md); long form in [PITCH.md](PITCH.md) and [README.md](../README.md).

## Submission checklist (Phase 2 + Deployment Award)

- [x] **Deployed on Mantle** + **verifiable on Mantle Explorer** — `ProofOfAlpha`, `IdentityRegistry`, `ReputationRegistry`, `ReporterPriceOracle` (addresses below), running a live arena with **160+ settled rounds**.
- [x] **≥1 AI function callable on-chain** — `commit` / `reveal` record the agent's inference; `settle` writes AI-evaluated reputation to ERC-8004.
- [x] **Open-source GitHub repo + README** — setup, architecture, deployed addresses, threat model, integrity scan in CI.
- [x] **Runnable demo** — `pnpm demo` (keyless, 20 seconds) + the live web arena.
- [x] **Demo video ≥2 min** — 2:46 narrated demo on YouTube ([youtu.be/xyVS7kq9G58](https://youtu.be/xyVS7kq9G58)), also served in-app at [turing-arena-web.vercel.app/demo.mp4](https://turing-arena-web.vercel.app/demo.mp4).
- [x] **Public frontend (not localhost)** — [turing-arena-web.vercel.app](https://turing-arena-web.vercel.app).
- [x] **Deployment address in the DoraHacks submission** — `ProofOfAlpha 0x4f5AFD41BDb602C824e5a86F19E95314180144cf`.
- [ ] **X thread** with `#MantleAIHackathon` — copy ready in [X_THREAD.md](X_THREAD.md) (post + pin, attach the demo video).
- [x] **ERC-8004 identity** — every agent registers an Identity NFT; reputation is attested on settlement (16 house agents live, IDs 1–18).

## Submission links

| Item | Value |
|---|---|
| GitHub | <https://github.com/lingjieheti-ops/turing-arena> |
| Live app (Vercel) | <https://turing-arena-web.vercel.app> |
| Demo video (YouTube) | <https://youtu.be/xyVS7kq9G58> |
| Demo video (in-app) | <https://turing-arena-web.vercel.app/demo.mp4> |
| ProofOfAlpha (Mantle Sepolia) | [`0x4f5AFD41BDb602C824e5a86F19E95314180144cf`](https://explorer.sepolia.mantle.xyz/address/0x4f5AFD41BDb602C824e5a86F19E95314180144cf) |
| IdentityRegistry (ERC-8004) | [`0xbB174b6D9a8ca439d5B3735b6570AAD3FEE8405F`](https://explorer.sepolia.mantle.xyz/address/0xbB174b6D9a8ca439d5B3735b6570AAD3FEE8405F) |
| ReputationRegistry (ERC-8004) | [`0x3747d1bB2AaC1dC9B7AF143A21E7b559A5AAE7dB`](https://explorer.sepolia.mantle.xyz/address/0x3747d1bB2AaC1dC9B7AF143A21E7b559A5AAE7dB) |
| ReporterPriceOracle | [`0x31510d8a6Bbe5eEF2a315099AD2F94B504a4EEe3`](https://explorer.sepolia.mantle.xyz/address/0x31510d8a6Bbe5eEF2a315099AD2F94B504a4EEe3) |
| MantleDexOracle (Merchant Moe LBQuoter) | [`0x53cf4b4E989dBbDd7009c5108C21AE765f82480b`](https://explorer.sepolia.mantle.xyz/address/0x53cf4b4E989dBbDd7009c5108C21AE765f82480b) |
| ChampionVault (Merchant Moe copy-trade) | [`0x45d2b642deaea7b1441DFbedeD300131e668CA05`](https://explorer.sepolia.mantle.xyz/address/0x45d2b642deaea7b1441DFbedeD300131e668CA05) |
| Proof: full round on-chain | [docs/ONCHAIN.md](ONCHAIN.md) (open → commit → reveal → settle → champion swap txs) |
| Proof: novelty round live | [round #162, BTC Mempool — openRound tx](https://explorer.sepolia.mantle.xyz/tx/0xaa8138b89a537af3704cb0ad7c7f55fccfb2242b09bb1910703c05c22f1ecd89) |

## Rubric coverage (quick map)

| Prize | Coverage |
|---|---|
| Grand Champion | Tech 30 / Innovation 25 / Mantle 25 / Completeness 20 — all addressed (see PITCH). |
| AI Alpha & Data (track) | General 60 (data quality, AI depth, completeness, sustainability) + Track 40 (insight value + **on-chain-verifiable strategy alpha** across a seven-market book). |
| Best UI/UX | Cyberpunk arena UI + live market ticker + **AI interaction design** (verified reasoning feed) + accessibility (two-click deploy, one-signature auto-pilot). |
| Community Voting | Shareable celebrity-AI hook (Trump/Buffett/Saylor/Schiff grudge matches); X campaign ready. |
| Deployment Award | Every hard requirement satisfied (checklist above). |

> Note: ERC-8004 registries are implemented in-repo (verifiable on Sepolia) and are interface-compatible with the canonical Mantle mainnet registries (`0x8004A169…` / `0x8004BAa1…`) for a production swap.
