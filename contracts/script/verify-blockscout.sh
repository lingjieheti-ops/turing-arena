#!/usr/bin/env bash
# Verify all Turing Arena contracts on the Mantle Sepolia Blockscout explorer.
#
# Source is public + reproducible regardless: `forge build` yields the same
# bytecode (solc 0.8.24, optimizer 200 runs, via_ir, evm_version=paris — see
# foundry.toml). This script publishes the source on the explorer for the green
# "Verified" check. Run it any time the explorer API is reachable:
#
#   bash script/verify-blockscout.sh
#
# (As of 2026-06-04 the explorer API was returning 503 — a Mantle-side outage.
#  Re-run when https://explorer.sepolia.mantle.xyz/api/v2/stats responds 200.)
set -euo pipefail

FORGE="${FORGE:-forge}"
VERIFIER_URL="${VERIFIER_URL:-https://explorer.sepolia.mantle.xyz/api/}"
CHAIN=5003
COMMON=(--chain-id "$CHAIN" --verifier blockscout --verifier-url "$VERIFIER_URL" --watch)
# Blockscout ignores the key, but forge's config loader wants the var set.
export MANTLESCAN_API_KEY="${MANTLESCAN_API_KEY:-unused}" ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-unused}"

# --- deployed addresses (Mantle Sepolia 5003) ---
IDENTITY=0xbB174b6D9a8ca439d5B3735b6570AAD3FEE8405F
REPUTATION=0x3747d1bB2AaC1dC9B7AF143A21E7b559A5AAE7dB
ORACLE=0x31510d8a6Bbe5eEF2a315099AD2F94B504a4EEe3
POA=0x4f5AFD41BDb602C824e5a86F19E95314180144cf
DEX_ORACLE=0x53cf4b4E989dBbDd7009c5108C21AE765f82480b
VAULT=0x45d2b642deaea7b1441DFbedeD300131e668CA05
# --- constructor inputs ---
OPERATOR=0xBAE35a0920252d16CA63D7F251AD0895D5963b1E
QUOTER=0x1a730E745Bb7fc433A3bAb7DC427b36b5C79B103
ROUTER=0xB268d323577C497A6C7f37EEd081aDa943c4dae9
METH=0xDfFe93fe7c48eBd526a06C6c5e57525a5b2409e7
USDY=0x21C0F50cE17beDcb1BA0Ed348f350784ac4F008D

enc() { cast abi-encode "$@"; }

echo "==> IdentityRegistry (no ctor args)"
"$FORGE" verify-contract "$IDENTITY" src/erc8004/IdentityRegistry.sol:IdentityRegistry "${COMMON[@]}"

echo "==> ReputationRegistry(address identity)"
"$FORGE" verify-contract "$REPUTATION" src/erc8004/ReputationRegistry.sol:ReputationRegistry \
  --constructor-args "$(enc 'constructor(address)' "$IDENTITY")" "${COMMON[@]}"

echo "==> ReporterPriceOracle(address reporter)"
"$FORGE" verify-contract "$ORACLE" src/oracle/ReporterPriceOracle.sol:ReporterPriceOracle \
  --constructor-args "$(enc 'constructor(address)' "$OPERATOR")" "${COMMON[@]}"

echo "==> ProofOfAlpha(address identity, address reputation, address operator)"
"$FORGE" verify-contract "$POA" src/ProofOfAlpha.sol:ProofOfAlpha \
  --constructor-args "$(enc 'constructor(address,address,address)' "$IDENTITY" "$REPUTATION" "$OPERATOR")" "${COMMON[@]}"

echo "==> MantleDexOracle(address quoter, address operator)"
"$FORGE" verify-contract "$DEX_ORACLE" src/oracle/MantleDexOracle.sol:MantleDexOracle \
  --constructor-args "$(enc 'constructor(address,address)' "$QUOTER" "$OPERATOR")" "${COMMON[@]}"

echo "==> ChampionVault(address poa, address router, address tokenA, address tokenB, uint256 maxBps, address keeper)"
"$FORGE" verify-contract "$VAULT" src/ChampionVault.sol:ChampionVault \
  --constructor-args "$(enc 'constructor(address,address,address,address,uint256,address)' \
    "$POA" "$ROUTER" "$METH" "$USDY" 20 "$OPERATOR")" "${COMMON[@]}"

echo "All verification requests submitted."
