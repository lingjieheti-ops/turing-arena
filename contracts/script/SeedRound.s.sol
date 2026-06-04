// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { ReporterPriceOracle } from "../src/oracle/ReporterPriceOracle.sol";
import { ProofOfAlpha } from "../src/ProofOfAlpha.sol";

/// @notice Pushes an entry price and opens a short demo round so the agent / web
///         app have a live round to join immediately after deploy.
///
/// Usage:
///   PRICE_ORACLE_ADDRESS=0x.. PROOF_OF_ALPHA_ADDRESS=0x.. \
///   forge script script/SeedRound.s.sol:SeedRound --rpc-url mantle_sepolia --broadcast -vvvv
contract SeedRound is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address oracleAddr = vm.envAddress("PRICE_ORACLE_ADDRESS");
        address poaAddr = vm.envAddress("PROOF_OF_ALPHA_ADDRESS");

        bytes32 asset = keccak256("METH/USD");
        uint256 entryPrice = vm.envOr("SEED_PRICE", uint256(3000e8)); // $3000, 1e8
        uint256 commitWin = vm.envOr("SEED_COMMIT_SECONDS", uint256(180));
        uint256 revealWin = vm.envOr("SEED_REVEAL_SECONDS", uint256(180));
        uint256 settleWin = vm.envOr("SEED_SETTLE_SECONDS", uint256(180));

        uint64 commitDeadline = uint64(block.timestamp + commitWin);
        uint64 revealDeadline = uint64(commitDeadline + revealWin);
        uint64 settleTime = uint64(revealDeadline + settleWin);

        vm.startBroadcast(pk);
        ReporterPriceOracle(oracleAddr).reportPrice(asset, entryPrice, "seed:manual");
        uint256 roundId = ProofOfAlpha(poaAddr)
            .openRound(asset, oracleAddr, "mETH/USD - demo", commitDeadline, revealDeadline, settleTime, 0);
        vm.stopBroadcast();

        console2.log("Seeded round", roundId);
        console2.log("  asset       : METH/USD");
        console2.log("  entryPrice  :", entryPrice);
        console2.log("  commitUntil :", commitDeadline);
        console2.log("  revealUntil :", revealDeadline);
        console2.log("  settleAt    :", settleTime);
    }
}
