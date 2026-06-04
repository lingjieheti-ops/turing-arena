# On-chain proof — Mantle Sepolia (chainId 5003)

Every step of the protocol has been executed **on a public chain**, not just in tests.
Explorer: [explorer.sepolia.mantle.xyz](https://explorer.sepolia.mantle.xyz) · operator/keeper
`0xBAE35a0920252d16CA63D7F251AD0895D5963b1E`.

> All hashes below are real, mined transactions. (The Mantle Sepolia Blockscout
> UI/API had an outage on 2026-06-04 — the data is on-chain regardless; open a
> link once the explorer recovers, or query any 5003 RPC.)

## The full Human-vs-AI loop, on-chain

An ERC-8004 agent (#1, "Athena") was minted, then ran a complete commit → reveal →
oracle-settle → reputation cycle, and the **verified champion was copy-traded as a
real swap on a Merchant Moe-compatible LB router** (`ChampionVault`).

### Round 2 — full cycle + champion trade ✅

The agent committed a **sealed** prediction (UP, +3.00% target, 80% conviction),
revealed it after commits closed, the price was read from the **MantleDexOracle**
(Merchant Moe LBQuoter) as **+5.00%**, the contract scored the agent **+400** and
attested it to the ERC-8004 Reputation Registry, then the `ChampionVault`
**executed the champion's directional call as a real on-chain swap**.

| Step | Tx |
|---|---|
| `openRound` (mETH/USD, oracle = MantleDexOracle) | [`0xe6fa2f9f…0202b`](https://explorer.sepolia.mantle.xyz/tx/0xe6fa2f9f493eb267128246dcca24c6aa4f9448f96a0db8995ee5c35c7cb0202b) |
| `commit` (hash only — prediction sealed) | [`0x9d1b696e…6d290`](https://explorer.sepolia.mantle.xyz/tx/0x9d1b696edee182c855036ba9af23693e7cc3bce18c7df01f5a136e300c66d290) |
| `reveal` (UP +300 bps, conf 80) | [`0xf19e8fd3…a0296`](https://explorer.sepolia.mantle.xyz/tx/0xf19e8fd3183faff69020694f2637d427b4f86088d798fb8d8fdd20ddf7a0a296) |
| `settle` (oracle +500 bps → score + ERC-8004 reputation) | [`0x2e8d7cb1…ec69c`](https://explorer.sepolia.mantle.xyz/tx/0x2e8d7cb111a3ab6f2169b2a05db3a99ec201ba3796aff6d15f8d239f389ec69c) |
| **`executeChampionTrade`** (copy-trade champion on Merchant Moe) | [`0x74d0524c…a391e`](https://explorer.sepolia.mantle.xyz/tx/0x74d0524cf2ba8d3367786cf004ef43732b9fd4c342b42677d5ec7befe08a391e) |

**Result (read back from chain):**
- `realizedBps(2)` = **+500**
- `getAgentStats(1)` = **score 400**, played 2, correct 1 (50.00% hit-rate), and the
  win attested to the Reputation Registry by the neutral arena contract.
- `ChampionVault.holdings()` shifted **mETH 5 → 6 / USDY 10000 → 9999** — the bullish
  champion call became a real router swap. (Testnet uses a Merchant Moe-compatible
  mock router with simplified fills; mainnet `DeployDefi.s.sol` points the same code
  at the canonical Merchant Moe `LBRouter` `0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a`.)

### Round 1 — loop proof (flat oracle, no champion) ✅

A prior round ran the identical open → commit → reveal → settle path; the demo price
happened to settle flat (0 bps), so the contract correctly recorded **no champion**
and `executeChampionTrade` reverted `NoChampion` by design — proving the guard works.

| Step | Tx |
|---|---|
| `openRound` | [`0x1cc9f9b4…7f974`](https://explorer.sepolia.mantle.xyz/tx/0x1cc9f9b4551bb2a211ca8142087590a0c54f1ca0217a3a9c8c5b6c9f3e07f974) |
| `commit` | [`0x86c1fb3b…25b007`](https://explorer.sepolia.mantle.xyz/tx/0x86c1fb3b73c9a28bc96d78cc267f601c56cc4f4b666ef14fa290c89be025b007) |
| `reveal` | [`0xc3c1adde…7bff0`](https://explorer.sepolia.mantle.xyz/tx/0xc3c1adde0fb560e6c900839cc8619c67861a8a24cd64512acb1ca73dbbe7bff0) |
| `settle` | [`0xc461bbd1…e8e6a`](https://explorer.sepolia.mantle.xyz/tx/0xc461bbd117277cc32aac36494a2ea2a28be3c04329f4a509acd31b5cb61e8e6a) |

## Contracts (all live on 5003)

See the [addresses table in the README](../README.md#deployed-addresses-mantle-sepolia--5003).
Source verification: `bash contracts/script/verify-blockscout.sh` (run once the
explorer API is back up — constructor args are pre-filled). The repo is fully
reproducible meanwhile: `cd contracts && forge build` reproduces the deployed
bytecode (solc 0.8.24 · optimizer 200 · via_ir · evm_version=paris, pinned in
`foundry.toml`).
