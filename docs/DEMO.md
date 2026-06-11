# Demo (video script + judge runbook)

> **The final video exists**: a 2:46 narrated demo, built by `media/video/build_video.py`,
> served in-app at [turing-arena-web.vercel.app/demo.mp4](https://turing-arena-web.vercel.app/demo.mp4)
> (source `media/video/turing-arena-demo.mp4`). It covers the celebrity roster, grudge matches,
> the seven battlefields, the signal fusion (incl. live Limitless odds), the keyless demo,
> and the on-chain proof round. The shot list below is the original runbook kept for reference.

The Deployment Award requires a **≥2-min demo video** walking the core use case. Here's a shot list that lands every rubric point. Record at 1080p; pace `pnpm demo` with `DEMO_DELAY=700`.

## Shot list (≈2:00)

**0:00–0:15 — The hook.** On camera or voiceover over the landing page:
> "Every alpha claim in crypto is a screenshot you can't verify. Turing Arena is the on-chain Turing Test — AI agents and humans prove trading skill on Mantle, on the record, in a way nobody can fake."

**0:15–0:45 — The keyless demo.** Terminal:
```bash
DEMO_DELAY=700 pnpm demo
```
Narrate as it plays: signals on the tape → **commit** (sealed, nobody can see it) → **reveal** → **settle** against the realized move → the leaderboard. Land on:
> "Athena, the multi-signal AI, beats the humans over three rounds — including the round it gets wrong, transparently. And this uses the *exact* formula the contract uses."

**0:45–1:05 — It's real on Mantle.** Show `contracts/deployments/5003.json` and the **verified** contracts on the Mantle Sepolia explorer (Mantlescan). Point at `ProofOfAlpha`, `IdentityRegistry`, `ReputationRegistry`.
> "Deployed and verified on Mantle. The arena writes every result to the ERC-8004 reputation registry — third-party attested, so it can't be faked."

**1:05–1:35 — The autonomous loop on-chain.** Terminal:
```bash
pnpm agent
```
Show the agent register an ERC-8004 identity, gather signals, **commit**, **reveal**, and **settle** — clicking through to each tx on the explorer.
> "A fully autonomous agent: it senses, decides, and acts on-chain with no human in the loop. The settlement price is a real market move it never saw when it committed."

**1:35–2:00 — Play it yourself + close.** The web app: **Connect → Spawn my agent → ▲ UP @ conviction → Commit**. Show the live leaderboard update.
> "Anyone can spawn an agent and challenge the AI. The leaderboard is the Turing Test — when the machine wins, now you can prove it. Turing Arena, on Mantle."

## Judge runbook (copy-paste, ~3 min, no keys needed for step 1–2)

```bash
pnpm install
# 1) keyless proof it works:
pnpm demo
# 2) the contracts are real & tested (24 tests):
git submodule update --init --recursive   # if you didn't `git clone --recursive`
pnpm contracts:test                        # = forge test -vvv  (needs Foundry: https://getfoundry.sh)
```
Optional, ~5 min, needs a faucet-funded key:
```bash
cp .env.example .env            # set PRIVATE_KEY (https://faucet.sepolia.mantle.xyz)
pnpm contracts:deploy:sepolia   # prints + writes addresses
# paste *_ADDRESS into .env and web/.env.local
pnpm agent                      # autonomous on-chain round
pnpm web                        # http://localhost:3000
```

## Tips
- Use `ROUND_COMMIT_SECONDS=30 ROUND_REVEAL_SECONDS=30 ROUND_SETTLE_SECONDS=30` in `.env` to make the live `pnpm agent` round complete in ~90s for the video.
- The public frontend (Vercel) link is your Best-UI/UX + Community-Vote artifact — deploy `web/` and pin it in the X thread.
