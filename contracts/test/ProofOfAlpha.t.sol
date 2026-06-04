// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentityRegistry } from "../src/erc8004/IdentityRegistry.sol";
import { ReputationRegistry } from "../src/erc8004/ReputationRegistry.sol";
import { ProofOfAlpha } from "../src/ProofOfAlpha.sol";
import { MockPriceOracle } from "./mocks/MockPriceOracle.sol";

contract ProofOfAlphaTest is Test {
    IdentityRegistry id;
    ReputationRegistry rep;
    MockPriceOracle oracle;
    ProofOfAlpha poa;

    bytes32 constant ASSET = keccak256("METH/USD");

    address ai = makeAddr("ai");
    address human = makeAddr("human");
    uint256 agentAI;
    uint256 agentHuman;

    uint64 commitDeadline;
    uint64 revealDeadline;
    uint64 settleTime;

    function setUp() public {
        id = new IdentityRegistry();
        rep = new ReputationRegistry(address(id));
        oracle = new MockPriceOracle();
        poa = new ProofOfAlpha(address(id), address(rep), address(this));

        vm.prank(ai);
        agentAI = id.register("ipfs://ai-card");
        vm.prank(human);
        agentHuman = id.register("ipfs://human-card");

        oracle.setPrice(ASSET, 100e8); // entry $100
        commitDeadline = uint64(block.timestamp + 1 hours);
        revealDeadline = uint64(block.timestamp + 2 hours);
        settleTime = uint64(block.timestamp + 3 hours);
    }

    function _open(uint256 stake) internal returns (uint256 roundId) {
        roundId = poa.openRound(
            ASSET, address(oracle), "mETH/USD - 1h", commitDeadline, revealDeadline, settleTime, stake
        );
    }

    function _commit(uint256 roundId, address who, uint256 agentId, int256 bps, uint8 conf, bytes32 salt)
        internal
        returns (bytes32 rationale)
    {
        rationale = keccak256(abi.encodePacked("rationale", agentId, bps));
        bytes32 h = poa.computeCommit(agentId, bps, conf, rationale, salt);
        vm.prank(who);
        poa.commit(roundId, agentId, h);
    }

    // --------------------------- happy path ------------------------------ //

    function test_fullRound_scores_and_attests_reputation() public {
        uint256 roundId = _open(0);

        bytes32 saltA = keccak256("saltA");
        bytes32 saltH = keccak256("saltH");
        bytes32 rA = _commit(roundId, ai, agentAI, 200, 80, saltA); // UP, 80% conviction
        bytes32 rH = _commit(roundId, human, agentHuman, -150, 60, saltH); // DOWN, 60%

        vm.warp(commitDeadline + 1);
        vm.prank(ai);
        poa.reveal(roundId, agentAI, 200, 80, rA, saltA);
        vm.prank(human);
        poa.reveal(roundId, agentHuman, -150, 60, rH, saltH);

        // settlement: price rose to $102 -> +200 bps
        vm.warp(settleTime);
        oracle.setPrice(ASSET, 102e8);
        poa.settle(roundId, 100);

        // AI bet up at 80% -> +160 ; Human bet down at 60% -> -120
        (int256 sA, uint32 pA, uint32 cA, uint32 accA) = poa.getAgentStats(agentAI);
        assertEq(sA, 160, "ai score");
        assertEq(pA, 1, "ai played");
        assertEq(cA, 1, "ai correct");
        assertEq(accA, 10000, "ai accuracy");

        (int256 sH,, uint32 cH,) = poa.getAgentStats(agentHuman);
        assertEq(sH, -120, "human score");
        assertEq(cH, 0, "human wrong");

        // round bookkeeping
        ProofOfAlpha.Round memory r = poa.getRound(roundId);
        assertTrue(r.settled, "settled");
        assertEq(r.topAgentId, agentAI, "winner is AI");
        assertEq(r.topScore, 160, "top score");
        assertEq(poa.realizedBps(roundId), 200, "realized bps");

        // ERC-8004 reputation attested by the arena (a neutral third party)
        assertEq(rep.getLastIndex(agentAI, address(poa)), 1, "one feedback for AI");
        (int128 v,, string memory t1,, bool revoked) = rep.readFeedback(agentAI, address(poa), 0);
        assertEq(v, 160, "rep value");
        assertEq(t1, "proof-of-alpha", "rep tag");
        assertFalse(revoked, "not revoked");
    }

    // --------------------------- anti-cheat ------------------------------ //

    function test_revert_commitAfterDeadline() public {
        uint256 roundId = _open(0);
        vm.warp(commitDeadline + 1);
        bytes32 h = poa.computeCommit(agentAI, 100, 50, keccak256("r"), keccak256("s"));
        vm.prank(ai);
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.CommitClosed.selector, roundId));
        poa.commit(roundId, agentAI, h);
    }

    function test_revert_nonControllerCommit() public {
        uint256 roundId = _open(0);
        bytes32 h = poa.computeCommit(agentAI, 100, 50, keccak256("r"), keccak256("s"));
        vm.prank(human); // human does not control agentAI
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.NotAgentController.selector, agentAI, human));
        poa.commit(roundId, agentAI, h);
    }

    function test_revert_doubleCommit() public {
        uint256 roundId = _open(0);
        _commit(roundId, ai, agentAI, 100, 50, keccak256("s"));
        bytes32 h = poa.computeCommit(agentAI, 100, 50, keccak256("r2"), keccak256("s2"));
        vm.prank(ai);
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.AlreadyCommitted.selector, roundId, agentAI));
        poa.commit(roundId, agentAI, h);
    }

    function test_revert_revealWrongPreimage() public {
        uint256 roundId = _open(0);
        bytes32 salt = keccak256("good");
        bytes32 r = _commit(roundId, ai, agentAI, 100, 50, salt);
        vm.warp(commitDeadline + 1);
        vm.prank(ai);
        vm.expectRevert(ProofOfAlpha.CommitMismatch.selector);
        poa.reveal(roundId, agentAI, 100, 50, r, keccak256("WRONG_SALT"));
    }

    function test_revert_revealOutsideWindow() public {
        uint256 roundId = _open(0);
        bytes32 salt = keccak256("s");
        bytes32 r = _commit(roundId, ai, agentAI, 100, 50, salt);
        // still in commit window -> reveal closed
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.RevealClosed.selector, roundId));
        vm.prank(ai);
        poa.reveal(roundId, agentAI, 100, 50, r, salt);
    }

    function test_revert_settleBeforeTime() public {
        uint256 roundId = _open(0);
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.NotYetSettleable.selector, roundId));
        poa.settle(roundId, 10);
    }

    function test_revert_badWindows() public {
        vm.expectRevert(ProofOfAlpha.BadWindows.selector);
        poa.openRound(ASSET, address(oracle), "x", commitDeadline, commitDeadline, settleTime, 0);
    }

    // --------------------------- stake + reward -------------------------- //

    function test_stakedRound_winnerTakesPool() public {
        uint256 stake = 1 ether;
        uint256 roundId = _open(stake);

        vm.deal(ai, stake);
        vm.deal(human, stake);

        bytes32 saltA = keccak256("a");
        bytes32 saltH = keccak256("h");
        bytes32 rA = keccak256(abi.encodePacked("rationale", agentAI, int256(300)));
        bytes32 rH = keccak256(abi.encodePacked("rationale", agentHuman, int256(-300)));
        // precompute hashes BEFORE prank (an inline call would consume the prank)
        bytes32 hA = poa.computeCommit(agentAI, 300, 90, rA, saltA);
        bytes32 hH = poa.computeCommit(agentHuman, -300, 90, rH, saltH);
        vm.prank(ai);
        poa.commit{ value: stake }(roundId, agentAI, hA);
        vm.prank(human);
        poa.commit{ value: stake }(roundId, agentHuman, hH);

        vm.warp(commitDeadline + 1);
        vm.prank(ai);
        poa.reveal(roundId, agentAI, 300, 90, rA, saltA);
        vm.prank(human);
        poa.reveal(roundId, agentHuman, -300, 90, rH, saltH);

        vm.warp(settleTime);
        oracle.setPrice(ASSET, 105e8); // +500 bps -> AI (up) wins
        poa.settle(roundId, 100);

        uint256 balBefore = ai.balance;
        vm.prank(ai);
        poa.claimReward(roundId, agentAI);
        assertEq(ai.balance - balBefore, 2 * stake, "winner takes whole pool");

        // double claim reverts
        vm.prank(ai);
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.AlreadyClaimed.selector, roundId));
        poa.claimReward(roundId, agentAI);
    }

    function test_revert_loserCannotClaim() public {
        uint256 stake = 1 ether;
        uint256 roundId = _open(stake);
        vm.deal(ai, stake);
        vm.deal(human, stake);

        bytes32 sA = keccak256("a");
        bytes32 sH = keccak256("h");
        bytes32 rA = keccak256(abi.encodePacked("rationale", agentAI, int256(300)));
        bytes32 rH = keccak256(abi.encodePacked("rationale", agentHuman, int256(-300)));
        bytes32 hA = poa.computeCommit(agentAI, 300, 90, rA, sA);
        bytes32 hH = poa.computeCommit(agentHuman, -300, 90, rH, sH);
        vm.prank(ai);
        poa.commit{ value: stake }(roundId, agentAI, hA);
        vm.prank(human);
        poa.commit{ value: stake }(roundId, agentHuman, hH);

        vm.warp(commitDeadline + 1);
        vm.prank(ai);
        poa.reveal(roundId, agentAI, 300, 90, rA, sA);
        vm.prank(human);
        poa.reveal(roundId, agentHuman, -300, 90, rH, sH);

        vm.warp(settleTime);
        oracle.setPrice(ASSET, 105e8);
        poa.settle(roundId, 100);

        vm.prank(human);
        vm.expectRevert(abi.encodeWithSelector(ProofOfAlpha.NotWinner.selector, roundId, agentHuman));
        poa.claimReward(roundId, agentHuman);
    }

    // --------------------------- pagination ------------------------------ //

    function test_settlePagination() public {
        uint256 roundId = _open(0);
        address third = makeAddr("third");
        vm.prank(third);
        uint256 agent3 = id.register("ipfs://3");

        bytes32 s = keccak256("s");
        bytes32 rA = _commit(roundId, ai, agentAI, 100, 50, s);
        bytes32 rH = _commit(roundId, human, agentHuman, 100, 50, s);
        bytes32 r3 = _commit(roundId, third, agent3, -100, 50, s);

        vm.warp(commitDeadline + 1);
        vm.prank(ai);
        poa.reveal(roundId, agentAI, 100, 50, rA, s);
        vm.prank(human);
        poa.reveal(roundId, agentHuman, 100, 50, rH, s);
        vm.prank(third);
        poa.reveal(roundId, agent3, -100, 50, r3, s);

        vm.warp(settleTime);
        oracle.setPrice(ASSET, 101e8); // +100 bps

        poa.settle(roundId, 2); // process 2 of 3
        assertFalse(poa.getRound(roundId).settled, "not yet");
        poa.settle(roundId, 2); // process remaining 1
        assertTrue(poa.getRound(roundId).settled, "now settled");

        (int256 s3,,,) = poa.getAgentStats(agent3);
        assertEq(s3, -50, "third bet down, was wrong"); // -1 * 100 * 50/100
    }

    function test_unrevealedScoresZero() public {
        uint256 roundId = _open(0);
        _commit(roundId, ai, agentAI, 100, 50, keccak256("s")); // never reveals
        vm.warp(settleTime);
        oracle.setPrice(ASSET, 110e8);
        poa.settle(roundId, 100);
        (int256 sA, uint32 pA,,) = poa.getAgentStats(agentAI);
        assertEq(sA, 0, "no score without reveal");
        assertEq(pA, 0, "not counted as played");
    }
}
