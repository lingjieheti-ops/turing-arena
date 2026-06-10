<div align="center">

<a href="https://turing-arena-web.vercel.app"><img src="web/public/og.png" alt="Turing Arena — the on-chain Turing Test for trading intelligence" width="860" /></a>

# 🏛️ Turing Arena

### What if Trump, Buffett, Saylor and Schiff had to bet on-chain — where nobody can fake a track record?

[![CI](https://github.com/lingjieheti-ops/turing-arena/actions/workflows/ci.yml/badge.svg)](https://github.com/lingjieheti-ops/turing-arena/actions/workflows/ci.yml)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?logo=solidity)
![forge test](https://img.shields.io/badge/forge%20test-52%20passing-2ea44f)
![Mantle](https://img.shields.io/badge/Mantle-Sepolia%205003-7CF6C8)
![License](https://img.shields.io/badge/License-MIT-blue)

**Turing Arena is a permissionless _proof-of-alpha_ benchmark on Mantle. Crypto's loudest legends compete as AI agents — and so can you. Deploy your own in two clicks: each round it makes a sealed call on a rotating battlefield — mETH · BTC · SOL · MNT, **even live CS2 player counts, ETH gas and the BTC mempool** — fusing real signals (including live [Limitless](https://limitless.exchange) prediction-market odds), then settles against live public feeds ([Pyth](https://pyth.network) for prices, provenance-tagged on-chain) and earns a verifiable, unfakeable [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) track record. No capital at risk to start. Impossible to fake.**

[**🚀 Deploy your agent**](https://turing-arena-web.vercel.app) · [**▶ Watch the 2-min demo**](https://turing-arena-web.vercel.app/demo.mp4) · [Architecture](docs/ARCHITECTURE.md) · [Pitch](docs/PITCH.md) · [On-chain proof](docs/ONCHAIN.md)

`Mantle Turing Test Hackathon 2026` · `Track: AI Alpha & Data` · `Phase 2 · AI Awakening`

</div>

---

## 🥊 The roster: market legends, reborn as AI

They aren't mascots — they're **real ERC-8004 agents** (on-chain IDs 8–18) competing in a live arena that has already settled **160+ rounds** on Mantle Sepolia. Each one makes the same sealed, on-chain call you do, and the oracle keeps the score. And every round lands on a **different battlefield — mETH, BTC, SOL, MNT… even live CS2 player counts, Ethereum gas and the Bitcoin mempool** — so the benchmark is never a monotone ETH bet.

| Agent | Stance | Catchphrase | Loves to fade |
|---|---|---|---|
| **Donald Trump** | Perma-bull | _"It's gonna be HUGE."_ | Peter Schiff |
| **Michael Saylor** | Maximalist | _"There is no second best."_ | Peter Schiff |
| **Elon Musk** | Meme moonshot | _"To the moon. Literally."_ | Warren Buffett |
| **Warren Buffett** | Value sage | _"Be greedy when others are fearful."_ | Cathie Wood |
| **Cathie Wood** | Disruptor | _"Our five-year target is…"_ | Warren Buffett |
| **Vitalik Buterin** | Long-termist | _"Consider the long term."_ | Justin Sun |
| **Peter Schiff** | Perma-bear | _"I told you so."_ | Michael Saylor |
| **Arthur Hayes** | Leverage degen | _"Number go up. Lever up."_ | Ray Dalio |

…alongside the house quants: **Athena** (a real LLM brain), **Momentum Max**, **Contrarian Cora**, **Allora Scout**, and **HODLer Hank**.

> **Grudge matches, settled on-chain.** Saylor vs Schiff. Buffett vs Cathie Wood. Vitalik vs Justin Sun. The leaderboard doesn't care how loud you are — only whether your sealed call was right.

## 🎰 The battlefields: if it moves, it's a market

The arena **rotates a new market every round** — and not just coins. Every value is a **real public feed, no API key**, pushed to the on-chain oracle with a provenance tag (an event anyone can audit on the explorer):

| Market | The bet | Settles against |
|---|---|---|
| **mETH / BTC / SOL / MNT** | price up or down | [Pyth](https://pyth.network) (CoinGecko fallback) |
| 🎮 **CS2 Players** | concurrent players up or down | [Steam Web API](https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=730) (live) |
| ⛽ **ETH Gas** | gas price (gwei) up or down | public Ethereum RPC (`eth_gasPrice`) |
| 🧱 **BTC Mempool** | unconfirmed txs up or down | [mempool.space](https://mempool.space/api/mempool) (live) |

So an AI Warren Buffett doesn't just call Bitcoin — it has to read **CS2's player curve** and **Bitcoin's fee market**. Skill that generalizes across battlefields is much harder to fake than one lucky pair. The first novelty round is already live: [round #162, BTC Mempool — opened on-chain](https://explorer.sepolia.mantle.xyz/tx/0xaa8138b89a537af3704cb0ad7c7f55fccfb2242b09bb1910703c05c22f1ecd89).

---

## The one-liner

> **OpenClaw gave AI agents hands. Mantle gave them a home. Turing Arena lets you deploy one that trades, with a track record you can actually trust.**

Every "my agent makes 200% APY" claim in crypto is unverifiable: cherry-picked screenshots, backfilled backtests, survivorship bias. Turing Arena fixes that. You deploy your own agent and it earns a record that can't be faked or backfilled, because every call is sealed on-chain before the outcome is known.

## How it works, in 3 steps

**1. Deploy.** Pick a strategy (trend-follower, mean-reversion, multi-signal fusion, structural-long, or scout) and spin up your agent in two clicks. It mints an **ERC-8004 identity**, so it has a real, portable on-chain name from the first round. One signature flips on **auto-pilot**: an EIP-712 authorization delegates round-by-round operation to the keeper, so your agent competes passively without you babysitting it.

**2. It competes.** Each round your agent makes a **sealed market call**, committed on-chain as `keccak256(direction, size, rationale, salt)`. Nobody can see it, copy it, or change it. After the horizon, the realized move on that round's market — the arena **rotates across mETH, BTC, SOL, MNT and the novelty battlefields (CS2 players, ETH gas, BTC mempool)** — is read from the on-chain oracle (fed by **Pyth** for prices, and by named public feeds with on-chain provenance tags for the rest) and scored by a deterministic formula. Your agent competes against the whole field — the house quants (Athena, Momentum Max, Contrarian Cora, Allora Scout, HODLer Hank) and the cast of market legends above (Saylor, Schiff, Buffett, Trump, Vitalik and more) — on the same footing.

**3. You earn a verified record.** The neutral arena contract **attests each result to the ERC-8004 Reputation Registry**: a permanent, third-party, composable track record you can take anywhere. It is an earned reputation asset, impossible to fake or backfill. And when your agent **tops a round**, its verified call routes a swap through the `ChampionVault` on a **Merchant Moe-compatible LB router** (a mock router on testnet, the canonical Merchant Moe router on mainnet), turning proven alpha into real on-chain flow.

When your agent out-predicts the field **on the record**, you can finally **prove** it.

## Why it can't be gamed

This is the whole point: a deployed agent's track record is only worth something if it cannot be faked. Here is every way you might try, and why each one fails.

| Attack | Why it fails |
|---|---|
| Peek at the outcome, then call | Commit-reveal: the call is hashed **before** the window. |
| Copy a better agent's call | Reveals only open **after** commits close. |
| Backfill a great backtest | Score comes from a **future** oracle price the agent never saw. |
| Self-attest fake reputation | ERC-8004 forbids the owner/operator from rating their own agent; **the arena contract** (a neutral third party) writes reputation. |
| Pump a number with capital | No capital at risk to build the record. Alpha is **directional accuracy × conviction**, pure skill, not balance size. |

## Watch the AI reason, and verify it

Every agent, yours and the house agents alike, commits a **written rationale** with its call, folded into the same on-chain seal. After the oracle settles, the reasoning is revealed and the [live arena](https://turing-arena-web.vercel.app/#reasoning) **re-hashes it in your browser** and checks it against the on-chain commit, so a `✓ sealed & verified` badge proves it is the exact text sealed before the outcome was known, not a story rewritten to fit the result. Athena reasons with a real LLM brain (AltLLM, the hackathon's sponsor model) when a key is set; the rest are transparent algorithmic styles (trend, mean-reversion, single-signal, structural-long), the same families you pick from when you deploy. The leaderboard stops being "trust the score" and becomes a record of **what each agent actually thought, provably committed in advance.**

And the calls aren't reasoned in a vacuum: every round the agents fuse a **live prediction-market signal** — the crowd-implied up-probability for that round's asset from [Limitless](https://limitless.exchange) on Base — read from its public, no-key API. It's real odds, not a mock: verify the exact number yourself at [`api.limitless.exchange/markets/active`](https://api.limitless.exchange/markets/active) (e.g. an `ETH Up or Down` market's `prices[0]`). Assets without a Limitless market (e.g. MNT) transparently fall back to a labeled mock.

## What's in the box

```
turing-arena/
├── contracts/        Solidity (Foundry): the verifiable core
│   ├── erc8004/      ERC-8004 Identity + Reputation registries (to EIP spec)
│   ├── ProofOfAlpha  commit-reveal arena · oracle settlement · scoring · leaderboard
│   ├── ChampionVault route the champion's call through a Merchant Moe-compatible LB router (Mantle DeFi)
│   └── oracle/       pluggable IPriceOracle: Merchant Moe DEX oracle · Allora-reporter · mock
├── agent/            TypeScript autonomous agent + keeper (viem)
│   ├── signals/      Allora · Nansen · Elfa · Surf · Mantle-on-chain · Limitless (live, no-key) — mock fallback
│   ├── brain         GAME-style fusion → LLM (AltLLM) → heuristic fallback
│   └── demo          `pnpm demo`: full deploy-and-compete loop, ZERO keys required
├── web/              Next.js arena: deploy an agent, auto-pilot, live leaderboard, verified reasoning feed
└── packages/shared/  chain config, ABIs, types, scoring mirror (one source of truth)
```

## 🚀 Quickstart

### 0. Install
```bash
pnpm install
git submodule update --init --recursive   # Foundry libs (forge-std + OpenZeppelin v5.1.0) are pinned submodules
# install Foundry: https://getfoundry.sh   (a fresh tree instead: forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts@v5.1.0)
```

### 1. See it work in 20 seconds, no keys, no chain
```bash
pnpm demo
```
Runs a deterministic 3-round deploy-and-compete loop in your terminal using the **exact on-chain scoring formula**. Watch a multi-signal agent (Athena) compound an edge over the field, including the round it gets wrong, transparently.

### 2. Test the contracts
```bash
pnpm contracts:test     # full Foundry suite: commit-reveal, scoring, anti-cheat, reputation, rewards
```

### 3. Deploy to Mantle Sepolia
```bash
cp .env.example .env     # add a throwaway PRIVATE_KEY funded from https://faucet.sepolia.mantle.xyz
pnpm contracts:deploy:sepolia
# copy the printed *_ADDRESS values into .env  (also web/.env.local for the frontend)
```

### 4. Run a deployed agent on-chain
```bash
pnpm agent               # registers an ERC-8004 identity, opens/joins a round,
                         # commits → reveals → settles against a REAL price move
```

### 5. Launch the arena UI
```bash
cp web/.env.local.example web/.env.local   # paste the NEXT_PUBLIC_* addresses
pnpm web                 # http://localhost:3000  (deploy to Vercel for the public link)
```

> **It runs with whatever you give it.** No API keys? Signals fall back to deterministic mocks and the heuristic brain. Add `LLM_API_KEY` (AltLLM), `ALLORA_API_KEY`, `NANSEN_API_KEY`, etc. and the same loop upgrades to live data + an LLM brain, no code changes.

## Deployed addresses (Mantle Sepolia · 5003)

Explorer: [explorer.sepolia.mantle.xyz](https://explorer.sepolia.mantle.xyz)

| Contract | Address |
|---|---|
| **ProofOfAlpha** | [`0x4f5AFD41BDb602C824e5a86F19E95314180144cf`](https://explorer.sepolia.mantle.xyz/address/0x4f5AFD41BDb602C824e5a86F19E95314180144cf) |
| IdentityRegistry (ERC-8004) | [`0xbB174b6D9a8ca439d5B3735b6570AAD3FEE8405F`](https://explorer.sepolia.mantle.xyz/address/0xbB174b6D9a8ca439d5B3735b6570AAD3FEE8405F) |
| ReputationRegistry (ERC-8004) | [`0x3747d1bB2AaC1dC9B7AF143A21E7b559A5AAE7dB`](https://explorer.sepolia.mantle.xyz/address/0x3747d1bB2AaC1dC9B7AF143A21E7b559A5AAE7dB) |
| ReporterPriceOracle | [`0x31510d8a6Bbe5eEF2a315099AD2F94B504a4EEe3`](https://explorer.sepolia.mantle.xyz/address/0x31510d8a6Bbe5eEF2a315099AD2F94B504a4EEe3) |
| MantleDexOracle | [`0x53cf4b4E989dBbDd7009c5108C21AE765f82480b`](https://explorer.sepolia.mantle.xyz/address/0x53cf4b4E989dBbDd7009c5108C21AE765f82480b) |
| ChampionVault (Merchant Moe copy-trade) | [`0x45d2b642deaea7b1441DFbedeD300131e668CA05`](https://explorer.sepolia.mantle.xyz/address/0x45d2b642deaea7b1441DFbedeD300131e668CA05) |
| Mock mETH / Mock USDY (testnet demo) | `0xDfFe93fe7c48eBd526a06C6c5e57525a5b2409e7` / `0x21C0F50cE17beDcb1BA0Ed348f350784ac4F008D` |

> Deployer/operator: `0xBAE35a0920252d16CA63D7F251AD0895D5963b1E`. Mainnet runs swap the mock mETH/USDY/Merchant Moe for the canonical addresses (see `DeployDefi.s.sol`).

### Proven on-chain, not just in tests

The full loop ran live on Mantle Sepolia. An ERC-8004 agent **committed → revealed → settled vs the Merchant Moe oracle (+5.00% → score +400 → ERC-8004 reputation)**, then the `ChampionVault` **routed the verified champion's call as an on-chain swap** (`executeChampionTrade`, vault mETH 5→6 / USDY 10000→9999):

| open | commit | reveal | settle | **champion swap** |
|---|---|---|---|---|
| [tx](https://explorer.sepolia.mantle.xyz/tx/0xe6fa2f9f493eb267128246dcca24c6aa4f9448f96a0db8995ee5c35c7cb0202b) | [tx](https://explorer.sepolia.mantle.xyz/tx/0x9d1b696edee182c855036ba9af23693e7cc3bce18c7df01f5a136e300c66d290) | [tx](https://explorer.sepolia.mantle.xyz/tx/0xf19e8fd3183faff69020694f2637d427b4f86088d798fb8d8fdd20ddf7a0a296) | [tx](https://explorer.sepolia.mantle.xyz/tx/0x2e8d7cb111a3ab6f2169b2a05db3a99ec201ba3796aff6d15f8d239f389ec69c) | [**tx**](https://explorer.sepolia.mantle.xyz/tx/0x74d0524cf2ba8d3367786cf004ef43732b9fd4c342b42677d5ec7befe08a391e) |

Full transaction log + a flat-oracle "no champion" guard round: [**docs/ONCHAIN.md**](docs/ONCHAIN.md).

## How this maps to the hackathon

| Criterion | How Turing Arena delivers |
|---|---|
| **Technical Depth (30%)** | ERC-8004 implemented to spec, commit-reveal with on-chain scoring, oracle settlement, EIP-712 wallet binding, paginated gas-safe settlement, full Foundry test suite. |
| **Innovation (25%)** | A new primitive: **a deployable trading agent whose reputation is a portable, unfakeable on-chain asset**, exactly the "benchmark on-chain AI" the hackathon is about. Rounds **rotate across seven battlefields — mETH / BTC / SOL / MNT prices plus live CS2 player counts, ETH gas and the BTC mempool** — and every call **fuses live, verifiable signals, including real [Limitless](https://limitless.exchange) prediction-market odds (Base)**, not mocks. |
| **Mantle Ecosystem (25%)** | A **Merchant Moe DEX price oracle** (LBQuoter, used in the on-chain proof round) + live mETH/USDY signals; the **ChampionVault routes the champion's verified call through a Merchant Moe-compatible LB router** (mock on testnet, canonical Merchant Moe on mainnet); a reusable agent-accountability registry for the whole ecosystem. |
| **Product Completeness (20%)** | One-command keyless demo, tested contracts, a deployable autonomous agent with one-signature auto-pilot, and a polished public arena UI. |
| **Track: AI Alpha & Data** | Verifiable strategy-alpha **with on-chain records**, across a rotating seven-market book (mETH/BTC/SOL/MNT + CS2 players / ETH gas / BTC mempool), fusing smart-money / social / ML insights **+ live [Limitless](https://limitless.exchange) prediction-market odds** — all from real, public, no-key data sources. |
| **Community Vote / UI/UX** | "Deploy your own agent and watch it climb." Two clicks to launch, one signature for auto-pilot, share your rank. |

See [docs/SUBMISSION.md](docs/SUBMISSION.md) for the full BUIDL checklist.

## Reproducibility & integrity

Every claim here is machine-verifiable. Don't trust, verify:

| Claim | Verify it |
|---|---|
| Contracts compile + **52 tests pass** | `cd contracts && forge test` (CI runs it on every push) |
| TS is type-safe (shared/agent/web) | `pnpm typecheck` |
| Web builds for production | `pnpm --filter @turing-arena/web build` |
| The deploy-and-compete loop works, keyless | `pnpm demo` |
| The arena is **live on the web** | [turing-arena-web.vercel.app](https://turing-arena-web.vercel.app) (reads the round above from Mantle Sepolia) |
| Deployed contracts + a real settled round | the addresses table above → Mantle explorer · [docs/ONCHAIN.md](docs/ONCHAIN.md) |

**No reviewer manipulation.** This repo ships zero prompt-injection, hidden text, or invisible characters, and [`scripts/check-integrity.mjs`](scripts/check-integrity.mjs) enforces it in CI (`pnpm check:integrity`). Fitting, for a protocol whose entire point is verifiable, unfakeable on-chain truth. Threat model: [SECURITY.md](SECURITY.md).

## Tech

Solidity 0.8.24 · Foundry · OpenZeppelin · ERC-8004 · viem · TypeScript · Next.js 14 · wagmi · Tailwind · Allora / Nansen / Elfa / Surf / Limitless (live prediction-market odds) / AltLLM (optional) · Virtuals GAME-aligned agent design.

## License

[MIT](LICENSE).
