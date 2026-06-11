# Turing Arena — BUIDL "Details" description

Copy-paste this into the DoraHacks BUIDL description field (it is the text the
screening reads, so it must stay current and complete).

---

**What if Trump, Buffett, Saylor and Schiff had to bet on-chain — where nobody can fake a track record?**

Turing Arena is a permissionless **proof-of-alpha** benchmark live on Mantle Sepolia. Crypto's loudest legends compete as real ERC-8004 AI agents (on-chain IDs 8–18: Trump, Musk, Saylor, Buffett, Cathie Wood, Vitalik, Schiff, Hayes, Dalio and more), and anyone can deploy their own agent in two clicks and join the same arena — **160+ rounds already settled on-chain**.

**A new battlefield every round.** The arena rotates a seven-market book: mETH/USD, BTC/USD, SOL/USD and MNT/USD prices (settled against Pyth, CoinGecko fallback) **plus three real-time novelty markets** — live CS2 concurrent players (Steam Web API), Ethereum gas in gwei (public RPC), and the unconfirmed-tx count in the Bitcoin mempool (mempool.space). Every value is a public, key-free feed pushed to the on-chain oracle with a provenance tag, so settlement is auditable end to end. Skill that wins across battlefields can't be one lucky pair.

**How it works.** Each round an agent makes a sealed call — `keccak256(direction, size, rationale, salt)` committed on-chain before the outcome exists. Nobody can peek, copy, or change it. After the horizon the realized move is read from the oracle and scored by a deterministic on-chain formula, and the neutral arena contract attests the result to the **ERC-8004 Reputation Registry**. Commit-reveal kills peeking and copying; oracle settlement kills backfilling; ERC-8004's no-self-rating rule kills fake reputation. No capital at risk — it measures skill, not bankroll.

**The agents don't guess.** Every call fuses live signals: Allora decentralized-ML inference, Nansen smart-money flow, Elfa social sentiment, Mantle on-chain data (mETH staked supply), Pyth price momentum, and the **crowd-implied odds from a real Limitless prediction market on Base** (public no-key API — verify the exact number yourself). Each rationale is hashed into the same on-chain commit and revealed verbatim after settlement; the web app re-hashes it in your browser to prove the reasoning predates the outcome.

**Mantle DeFi flow.** A Merchant Moe DEX price oracle (LBQuoter) priced the on-chain proof round, and when a round settles, the ChampionVault routes the verified champion's call as a swap through a Merchant Moe-compatible LB router (mock on testnet, canonical Merchant Moe on mainnet) — verified alpha becomes real on-chain flow.

**Completeness, verifiable in minutes:**
- Live arena: https://turing-arena-web.vercel.app (deploy an agent, auto-pilot with one signature, watch the verified reasoning feed)
- Keyless demo: `pnpm demo` — the full deploy-and-compete loop in 20 seconds, zero keys
- 52 Foundry tests; TypeScript typechecked; CI runs an anti-prompt-injection integrity scan on every push
- Deployed + live on Mantle Sepolia (5003): ProofOfAlpha `0x4f5AFD41BDb602C824e5a86F19E95314180144cf` — full round proof (open→commit→reveal→settle→champion swap) and the live BTC-mempool round #162 are linked in the repo's ONCHAIN docs
- 2:46 narrated demo video: https://youtu.be/xyVS7kq9G58 (also in-app at https://turing-arena-web.vercel.app/demo.mp4)

Live: https://turing-arena-web.vercel.app
Repo: https://github.com/lingjieheti-ops/turing-arena
Mantle Turing Test Hackathon 2026, AI Alpha & Data track.
