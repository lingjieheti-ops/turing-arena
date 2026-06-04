// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { IdentityRegistry } from "../src/erc8004/IdentityRegistry.sol";
import { ReputationRegistry } from "../src/erc8004/ReputationRegistry.sol";
import { ReporterPriceOracle } from "../src/oracle/ReporterPriceOracle.sol";
import { ProofOfAlpha } from "../src/ProofOfAlpha.sol";

/// @notice Deploys the full Turing Arena stack and writes the addresses to
///         deployments/<chainId>.json (consumed by the agent + web app).
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url mantle_sepolia --broadcast --verify --slow -vvvv
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);
        IdentityRegistry identity = new IdentityRegistry();
        ReputationRegistry reputation = new ReputationRegistry(address(identity));
        ReporterPriceOracle oracle = new ReporterPriceOracle(deployer);
        ProofOfAlpha poa = new ProofOfAlpha(address(identity), address(reputation), deployer);
        vm.stopBroadcast();

        console2.log("==========================================================");
        console2.log("Turing Arena deployed on chainId", block.chainid);
        console2.log("  IdentityRegistry  :", address(identity));
        console2.log("  ReputationRegistry:", address(reputation));
        console2.log("  PriceOracle       :", address(oracle));
        console2.log("  ProofOfAlpha      :", address(poa));
        console2.log("  Operator/Deployer :", deployer);
        console2.log("==========================================================");
        console2.log("Paste into .env :");
        console2.log("IDENTITY_REGISTRY_ADDRESS=", address(identity));
        console2.log("REPUTATION_REGISTRY_ADDRESS=", address(reputation));
        console2.log("PRICE_ORACLE_ADDRESS=", address(oracle));
        console2.log("PROOF_OF_ALPHA_ADDRESS=", address(poa));

        string memory obj = "deployment";
        vm.serializeUint(obj, "chainId", block.chainid);
        vm.serializeAddress(obj, "operator", deployer);
        vm.serializeAddress(obj, "identityRegistry", address(identity));
        vm.serializeAddress(obj, "reputationRegistry", address(reputation));
        vm.serializeAddress(obj, "priceOracle", address(oracle));
        string memory json = vm.serializeAddress(obj, "proofOfAlpha", address(poa));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
