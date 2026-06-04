// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console2 } from "forge-std/Script.sol";
import { MantleDexOracle } from "../src/oracle/MantleDexOracle.sol";
import { ChampionVault } from "../src/ChampionVault.sol";
import { MockERC20 } from "../test/mocks/MockERC20.sol";
import { MockLBQuoter, MockLBRouter } from "../test/mocks/MockMerchantMoe.sol";

/// @notice Self-contained DeFi layer for a TESTNET champion demo: deploys mock
///         mETH/USDY + a Merchant Moe-compatible mock router/quoter + the real
///         MantleDexOracle + ChampionVault, and seeds liquidity so the champion
///         copy-trade actually executes on Mantle Sepolia. Use the printed
///         MantleDexOracle as the round oracle.
///
///   PROOF_OF_ALPHA_ADDRESS=0x.. \
///   forge script script/DeployDefiMock.s.sol:DeployDefiMock --rpc-url mantle_sepolia --broadcast -vvvv
contract DeployDefiMock is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address poa = vm.envAddress("PROOF_OF_ALPHA_ADDRESS");

        vm.startBroadcast(pk);
        MockERC20 meth = new MockERC20("Mock Mantle Staked ETH", "mETH", 18);
        MockERC20 usdy = new MockERC20("Mock Ondo USD Yield", "USDY", 18);
        MockLBQuoter quoter = new MockLBQuoter();
        MockLBRouter router = new MockLBRouter();

        MantleDexOracle oracle = new MantleDexOracle(address(quoter), deployer);
        address[] memory path = new address[](2);
        path[0] = address(meth);
        path[1] = address(usdy);
        oracle.setRoute(keccak256("METH/USD"), path, 1e18, 18);

        ChampionVault vault =
            new ChampionVault(poa, address(router), address(meth), address(usdy), 20, deployer);

        // seed: vault holds capital to copy-trade; router holds liquidity to fill swaps
        usdy.mint(address(vault), 10_000e18);
        meth.mint(address(vault), 5e18);
        meth.mint(address(router), 1_000_000e18);
        usdy.mint(address(router), 1_000_000e18);
        vm.stopBroadcast();

        console2.log("Mock mETH        ", address(meth));
        console2.log("Mock USDY        ", address(usdy));
        console2.log("MantleDexOracle  ", address(oracle), "(use as the round oracle)");
        console2.log("ChampionVault    ", address(vault));

        string memory obj = "defi";
        vm.serializeAddress(obj, "mantleDexOracle", address(oracle));
        vm.serializeAddress(obj, "championVault", address(vault));
        vm.serializeAddress(obj, "mockMeth", address(meth));
        string memory json = vm.serializeAddress(obj, "mockUsdy", address(usdy));
        vm.writeJson(json, string.concat("./deployments/", vm.toString(block.chainid), "-defi.json"));
    }
}
