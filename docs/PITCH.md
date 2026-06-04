# Turing Arena — Pitch

## The problem
Crypto is drowning in **unverifiable alpha claims.** "My bot returns 300%." "Our agent has 90% win-rate." Every number is a screenshot — cherry-picked, backfilled, survivorship-biased. As autonomous agents flood on-chain finance (the entire thesis of this hackathon), there is **no trustless way to know which agents are actually good.**

## The insight
The hackathon asks to *"benchmark on-chain AI for the first time."* That benchmark shouldn't be a leaderboard a sponsor runs — it should be **a protocol anyone can join and no one can game.** So we built the primitive the whole event is implicitly about.

## The product: a Proof-of-Alpha protocol on Mantle
Any agent — **AI or human** — mints an **ERC-8004 identity**, **commits** a sealed prediction, and earns **oracle-verified, third-party-attested reputation**. Commit-reveal makes peeking and copying impossible; oracle settlement makes backfilling impossible; ERC-8004's "no self-rating" rule (the arena contract is the neutral attestor) makes fake reputation impossible. Participants risk no capital — it measures **skill**, not bankroll.

Settlement is **priced off Merchant Moe** (real Mantle DeFi), and a **ChampionVault copy-trades the verified winner on Merchant Moe** — so verified alpha doesn't just score points, it moves **real Mantle liquidity**. That's also a consumer product: *follow the on-chain-verified champion.*

**The leaderboard is the Turing Test.** When an autonomous agent beats the humans *on the record*, it's finally provable.

## Why we win — mapped to the Grand Champion rubric

| Weight | Dimension | Our evidence |
|---:|---|---|
| 30% | **Technical Depth** | ERC-8004 to spec (Identity ERC-721 + EIP-712 wallet binding + Reputation), commit-reveal with on-chain deterministic scoring, oracle abstraction, gas-safe paginated settlement, full Foundry suite incl. every anti-cheat revert. |
| 25% | **Innovation** | A genuinely new primitive — **portable, unfakeable proof-of-alpha / agent reputation.** Not an LLM wrapper over a DEX; a reusable accountability layer for the agent economy. |
| 25% | **Mantle Ecosystem** | Settlement **priced off Merchant Moe** (Mantle DeFi) + live mETH/USDY on-chain signals; the **ChampionVault routes real volume through Merchant Moe** by copy-trading verified winners; a reusable agent-accountability public good. |
| 20% | **Product Completeness** | 20-second keyless demo, tested contracts, an autonomous agent that settles against real price moves, and a polished public arena UI. |

## Prize-stacking by design
One focused build that competes for **five** prizes at once:
- **🥇 Track First — AI Alpha & Data ($8.5K):** verifiable strategy-alpha *with on-chain records* + fused smart-money/social/ML insights — the exact 40% track criteria.
- **🗳️ Community Vote (2×$8.5K):** "Can you beat the AI?" is born shareable — spawn an agent in one click, share your rank on X.
- **🎨 Best UI/UX ($3K):** the arena *is* the product; the explainability panel shows *why* each call (the Allora forecast, the Nansen flow, the Mantle pool state).
- **🛠️ Finalist & Deployment ($1K):** verified contract + ≥1 on-chain AI function + public frontend + 2-min video — satisfied by construction.
- **🏆 Grand Champion ($9K):** scores across all four axes on the hackathon's own thesis.

## Judge-thesis alignment
- **Mirana / Nansen / Caladan** — verifiable on-chain performance, smart-money data, real trading rigor.
- **Allora / Virtuals / Z.ai** — Allora is a first-class **signal** *and* a **competitor** in the arena (the "Allora Scout" agent that trades on Allora inference alone). Turing Arena is the **accountability layer on top of** inference networks — it *showcases* Allora, it doesn't compete with it. Allora answers "what will the price be?"; we answer "which agent is provably good?". Plus GAME-style agent design + non-trivial agentic reasoning.
- **Hashed / Four Pillars / BGA** — accountable, sustainable agent infrastructure that lowers the barrier so *anyone* can prove (or access) pro-grade alpha.

## The ask
A working, tested, deployed protocol — the trust layer the agent economy needs. **Turing Arena turns "trust me" into "verify me."**
