// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MantleDexOracle } from "../src/oracle/MantleDexOracle.sol";
import { ChampionVault } from "../src/ChampionVault.sol";

/// @notice Deploys the Mantle DeFi layer (real Merchant Moe) on top of an already
///         deployed ProofOfAlpha. Defaults are the canonical Mantle MAINNET
///         addresses; override via env for testnet/mocks.
///
///   PROOF_OF_ALPHA_ADDRESS=0x.. \
///   forge script script/DeployDefi.s.sol:DeployDefi --rpc-url mantle --broadcast --verify --slow -vvvv
contract DeployDefi is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address poa = vm.envAddress("PROOF_OF_ALPHA_ADDRESS");

        address router = vm.envOr("MERCHANT_MOE_ROUTER", 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a);
        address quoter = vm.envOr("MERCHANT_MOE_QUOTER", 0x501b8AFd35df20f531fF45F6f695793AC3316c85);
        address meth = vm.envOr("METH_ADDRESS", 0xcDA86A272531e8640cD7F1a92c01839911B90bb0);
        address usdy = vm.envOr("USDY_ADDRESS", 0x5bE26527e817998A7206475496fDE1E68957c5A6);
        // NOTE: confirm the real mETH/USDY LB pair bin step before mainnet swaps.
        uint256 binStep = vm.envOr("LB_BIN_STEP", uint256(20));

        vm.startBroadcast(pk);
        MantleDexOracle oracle = new MantleDexOracle(quoter, deployer);
        address[] memory path = new address[](2);
        path[0] = meth;
        path[1] = usdy;
        oracle.setRoute(keccak256("METH/USD"), path, 1e18, 18); // 1 mETH priced in USDY
        ChampionVault vault = new ChampionVault(poa, router, meth, usdy, binStep, deployer);
        vm.stopBroadcast();

        console2.log("MantleDexOracle ", address(oracle));
        console2.log("ChampionVault   ", address(vault));
        console2.log("MANTLE_DEX_ORACLE_ADDRESS=", address(oracle));
        console2.log("CHAMPION_VAULT_ADDRESS=", address(vault));

        string memory obj = "defi";
        vm.serializeAddress(obj, "mantleDexOracle", address(oracle));
        string memory json = vm.serializeAddress(obj, "championVault", address(vault));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), "-defi.json"));
    }
}
