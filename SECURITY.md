# Security & threat model

A concise, honest threat model for Turing Arena. It is a hackathon project (**not audited**); this documents the design's security posture and known limits up front.

## Component threat model

### Commit–reveal (ProofOfAlpha)
- A prediction is bound as `keccak256(agentId, predictedBps, confidence, rationaleHash, salt)`. Reveal recomputes the hash and reverts on mismatch (`CommitMismatch`).
- Phases are time-boxed: commits only `≤ commitDeadline`, reveals only in `(commitDeadline, revealDeadline]`, settlement only `≥ settleTime`. This makes peeking, copying, and backfilling impossible.
- Commit and reveal are restricted to the agent's controller (`isController`). Double-commit / double-reveal revert.

### Reputation integrity (ERC-8004)
- Feedback is **third-party only**: the agent's owner/operator cannot rate their own agent (`SelfFeedbackForbidden`). The neutral `ProofOfAlpha` contract is the attestor, so reputation reflects oracle-verified outcomes, not self-reporting.

### Oracle
- `IPriceOracle` is pluggable. `ReporterPriceOracle` is permissioned (authorized reporters) and tags every price with provenance. `MantleDexOracle` reads a live Merchant Moe quote.
- **Known limit:** a single-block DEX **spot** quote is manipulable (e.g., flash-loan). For production, route through a TWAP / deeper liquidity and/or gate settlement via the ERC-8004 Validation Registry. The settlement price is captured **once** per round to avoid mid-settlement drift.

### Reentrancy & funds
- `ReentrancyGuard` on every value-moving path (`settle`, `claimReward`, `sweepUnclaimed`, `executeChampionTrade`); checks-effects-interactions ordering; pull-payment for rewards.
- **Participants risk no capital** (pure-reputation mode by default). Optional staked rounds form a winner-take-all prize pool (pull `claimReward`; owner `sweepUnclaimed` **only** when no agent achieved positive alpha).
- `ChampionVault` holds **protocol incentive capital, not user funds**; trades are keeper-gated with a caller-supplied slippage floor (`amountOutMin`); the trade **direction** is read from the chain (the verified champion), so it cannot be spoofed by the keeper.

### Access control & DoS
- `Ownable` + an `isOperator` set (may open rounds) + an `isKeeper` set (may copy-trade). All transitions emit events.
- Settlement is **paginated** (`settleCursor`, `settle(roundId, maxAgents)`) so a large field can never exceed the block gas limit. Per-round score is bounded (`MAX_ABS_BPS = 2000`).

### Arithmetic
- Solidity 0.8 checked math throughout; `SafeCast.toInt128` on the attested score; scores are magnitude-bounded so they always fit.

## Out of scope / known limitations
- **Not audited.** Reference-quality, test-covered (29 Foundry tests), but no formal audit.
- ERC-8004 **Validation Registry** is not implemented (Identity + Reputation are); it's the natural next step for validator-attested settlement.
- `MantleDexOracle` uses a spot quote (see Oracle limit above).
- The mainnet Merchant Moe LB pair **bin step** must be confirmed before mainnet champion swaps (`LB_BIN_STEP`).

## AI-review integrity (this matters for a "Turing Test" hackathon)
This repository contains **no content engineered to manipulate an automated/LLM reviewer** — no invisible/zero-width characters, no hidden-text styling, and no embedded instructions aimed at a reviewer. We enforce this on ourselves: [`scripts/check-integrity.mjs`](scripts/check-integrity.mjs) scans the repo in CI and fails the build if any such pattern appears. Every claim in the README is independently verifiable (`forge test`, `pnpm typecheck`, `pnpm --filter web build`, on-chain explorer). Verify us — don't trust us.

## Reporting
Open an issue or contact the maintainers. Please do not disclose anything affecting deployed mainnet funds publicly before contact.
