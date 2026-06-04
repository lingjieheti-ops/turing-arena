// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentityRegistry } from "../src/erc8004/IdentityRegistry.sol";
import { ReputationRegistry } from "../src/erc8004/ReputationRegistry.sol";
import { ProofOfAlpha } from "../src/ProofOfAlpha.sol";
import { ChampionVault } from "../src/ChampionVault.sol";
import { MantleDexOracle } from "../src/oracle/MantleDexOracle.sol";
import { MockERC20 } from "./mocks/MockERC20.sol";
import { MockLBQuoter, MockLBRouter } from "./mocks/MockMerchantMoe.sol";

/// Integration: settle off a Merchant Moe quote (MantleDexOracle) and copy-trade
/// the verified champion on Merchant Moe (ChampionVault) — the real Mantle DeFi layer.
contract DefiLayerTest is Test {
    bytes32 constant ASSET = keccak256("METH/USD");

    MockERC20 base; // mETH
    MockERC20 quote; // USDY
    MockLBQuoter quoter;
    MockLBRouter router;
    MantleDexOracle dexOracle;

    IdentityRegistry id;
    ReputationRegistry rep;
    ProofOfAlpha poa;
    ChampionVault vault;

    address ai = makeAddr("ai");
    address human = makeAddr("human");
    uint256 agentAI;
    uint256 agentHuman;

    function setUp() public {
        base = new MockERC20("Mantle Staked Ether", "mETH", 18);
        quote = new MockERC20("Ondo USD Yield", "USDY", 18);
        quoter = new MockLBQuoter(); // price 3000e18
        router = new MockLBRouter(); // rate 1e18

        dexOracle = new MantleDexOracle(address(quoter), address(this));
        address[] memory path = new address[](2);
        path[0] = address(base);
        path[1] = address(quote);
        dexOracle.setRoute(ASSET, path, 1e18, 18);

        id = new IdentityRegistry();
        rep = new ReputationRegistry(address(id));
        poa = new ProofOfAlpha(address(id), address(rep), address(this));
        vault = new ChampionVault(
            address(poa), address(router), address(base), address(quote), 20, address(this)
        );

        // seed: vault holds quote (to buy base), router holds both (to deliver swaps)
        quote.mint(address(vault), 1000e18);
        base.mint(address(router), 1_000_000e18);
        quote.mint(address(router), 1_000_000e18);

        vm.prank(ai);
        agentAI = id.register("ipfs://ai");
        vm.prank(human);
        agentHuman = id.register("ipfs://human");
    }

    function _runRound(int256 aiBps, uint8 aiConf, int256 hBps, uint8 hConf, uint256 settlePriceE18)
        internal
        returns (uint256 roundId)
    {
        uint64 c = uint64(block.timestamp + 1 hours);
        uint64 rv = uint64(block.timestamp + 2 hours);
        uint64 st = uint64(block.timestamp + 3 hours);
        roundId = poa.openRound(ASSET, address(dexOracle), "mETH/USD", c, rv, st, 0);

        bytes32 ra = keccak256("ra");
        bytes32 rh = keccak256("rh");
        bytes32 ha = poa.computeCommit(agentAI, aiBps, aiConf, ra, ra);
        bytes32 hh = poa.computeCommit(agentHuman, hBps, hConf, rh, rh);
        vm.prank(ai);
        poa.commit(roundId, agentAI, ha);
        vm.prank(human);
        poa.commit(roundId, agentHuman, hh);

        vm.warp(c + 1);
        vm.prank(ai);
        poa.reveal(roundId, agentAI, aiBps, aiConf, ra, ra);
        vm.prank(human);
        poa.reveal(roundId, agentHuman, hBps, hConf, rh, rh);

        vm.warp(st);
        quoter.setPrice(settlePriceE18);
        poa.settle(roundId, 100);
    }

    function test_oracle_readsDexQuote() public {
        (uint256 p,) = dexOracle.getPrice(ASSET);
        assertEq(p, 3000e8, "1 mETH = 3000 USDY -> $3000 (1e8)");
        quoter.setPrice(3210e18);
        (p,) = dexOracle.getPrice(ASSET);
        assertEq(p, 3210e8);
    }

    function test_champion_long_copyTrade() public {
        // AI bets UP, price rises -> AI champion -> vault buys base with quote
        uint256 roundId = _runRound(200, 80, -150, 60, 3060e18);
        assertEq(poa.getRound(roundId).topAgentId, agentAI, "AI is champion");

        uint256 out = vault.executeChampionTrade(roundId, 100e18, 0, block.timestamp + 1);
        assertEq(out, 100e18, "1:1 mock swap");

        (uint256 b, uint256 q) = vault.holdings();
        assertEq(b, 100e18, "vault now holds base (long)");
        assertEq(q, 900e18, "vault spent quote");
        assertTrue(vault.traded(roundId));

        vm.expectRevert(abi.encodeWithSelector(ChampionVault.AlreadyTraded.selector, roundId));
        vault.executeChampionTrade(roundId, 100e18, 0, block.timestamp + 1);
    }

    function test_champion_short_copyTrade() public {
        base.mint(address(vault), 500e18); // vault needs base to sell on a short
        // AI bets DOWN, price falls -> AI champion -> vault sells base for quote
        uint256 roundId = _runRound(-200, 80, 150, 60, 2940e18);
        assertEq(poa.getRound(roundId).topAgentId, agentAI, "AI is champion");

        uint256 out = vault.executeChampionTrade(roundId, 50e18, 0, block.timestamp + 1);
        assertEq(out, 50e18);

        (uint256 b, uint256 q) = vault.holdings();
        assertEq(b, 450e18, "sold 50 base");
        assertEq(q, 1050e18, "received 50 quote");
    }

    function test_revert_tradeUnsettledRound() public {
        uint64 c = uint64(block.timestamp + 1 hours);
        uint256 roundId = poa.openRound(ASSET, address(dexOracle), "mETH/USD", c, c + 1 hours, c + 2 hours, 0);
        vm.expectRevert(abi.encodeWithSelector(ChampionVault.RoundNotSettled.selector, roundId));
        vault.executeChampionTrade(roundId, 1e18, 0, block.timestamp + 1);
    }

    function test_revert_nonKeeper() public {
        uint256 roundId = _runRound(200, 80, -150, 60, 3060e18);
        vm.prank(human);
        vm.expectRevert(abi.encodeWithSelector(ChampionVault.NotKeeper.selector, human));
        vault.executeChampionTrade(roundId, 100e18, 0, block.timestamp + 1);
    }
}
