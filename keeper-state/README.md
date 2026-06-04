# keeper-state/

Durable state for the Turing Arena **keeper** (`agent/src/keeper.ts`). This
directory **is committed to git** and the GitHub Actions keeper workflow pushes
it back after every tick, so the keeper is stateful across runs without any
database.

Everything here is **safe to publish**:

| File | Contents | Why it's safe |
| --- | --- | --- |
| `agents.json` | `personaName → agentId` (ERC-8004 token ids) | Public on-chain identities. |
| `cursor.json` | settle `lowWaterMark` + last pushed price | Public chain data. |
| `reveals/r<roundId>-a<agentId>.json` | `predictedBps`, `confidence`, `rationaleHash`, `salt`, `agentId` | Commit-reveal preimages. Once the reveal window opens these are revealed **on-chain anyway**, so publishing them changes nothing. They let the next keeper tick reveal a prediction it committed in an earlier tick. |

🔑 **The private key is NEVER stored here.** It lives only in the
`KEEPER_PRIVATE_KEY` GitHub Actions secret (and your local `.env` when you run a
tick by hand). Do not add `.env`, keys, or mnemonics to this folder.
