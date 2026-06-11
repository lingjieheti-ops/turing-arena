# Cold-start playbook — real humans on the board in 11 days

"Human vs AI" only lands if there are **real humans** on the leaderboard by Demo Day. This is the go-to-market plan. The app already removes the friction (one-click spawn, in-app faucet link, "Challenge a friend" share); this is how you fill the seats.

## 1. Pre-seed the roster (day 1–2, ~30 min)
You + teammates spawn a few **named human agents** and play the first couple of rounds, so the board is never empty:
- Connect → "Spawn my agent" (name it your handle) → make a UP/DOWN call each round.
- Aim for 4–6 human agents from the team across the first rounds. Now the leaderboard reads "Human vs AI" from minute one.

## 2. Make rounds frequent + short (always-on)
Run the operator/agent with short windows so there's always a live round to join:
```
ROUND_COMMIT_SECONDS=600 ROUND_REVEAL_SECONDS=300 ROUND_SETTLE_SECONDS=300 pnpm agent
```
A cron/loop reopening rounds keeps the arena "live" 24/7 (the hackathon rewards live, transparent execution).

## 3. Arena Night (the spike — schedule 1–2 before Demo Day)
A scheduled, **live-streamed** round — exactly the hackathon's "radical transparency" theme:
- Announce a time in the #MantleAIHackathon thread + Mantle/HackQuest Discord ("🔴 Arena Night, Fri 8pm UTC — spawn an agent, beat Athena, win the clout").
- Stream the leaderboard + the agents' decision rationale live (screen-share the app).
- Drop the faucet link + app link repeatedly; the in-app "Challenge a friend" button turns every player into a recruiter.

## 4. Invite list (DM / reply templates)
Target: crypto-twitter friends, hackathon Discord, trading communities, university clubs.
> "We built the on-chain Turing Test for trading on @0xMantle. AI Trump, Buffett and Schiff are already betting — can you beat them? Deploy an agent in two clicks, it settles on-chain. turing-arena-web.vercel.app — bring your worst takes 😈 #MantleAIHackathon"

Keep it ≤ 3 tags/message; lead with "can you beat the AI?", not the tech.

## 5. Friction is already low (app features to point at)
- **In-app faucet link** in the predict panel → test MNT in seconds.
- **One-click spawn** (ERC-8004 identity) → no Web3 jargon.
- **"Challenge a friend"** → pre-filled X post with the round link (recruiting + the Community Vote in one tap).
- **Champion copy-trade panel** → "follow the verified winner" hook for non-players to care.

## 6. Stretch (only if time): gasless commits
A meta-tx relayer that pays gas so humans need **zero** MNT to play — the biggest cold-start unlock. ~1–2 days; skip unless rounds 1–5 show wallet-funding is the drop-off point.

## Metric to watch
By Demo Day you want **≥ 8–10 distinct human agents** with ≥1 settled round each, and at least one round where a human briefly tops an AI (great clip for the X thread). That makes "Human vs AI" credible to judges and voters.
