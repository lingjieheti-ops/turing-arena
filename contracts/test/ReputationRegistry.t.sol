// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentityRegistry } from "../src/erc8004/IdentityRegistry.sol";
import { ReputationRegistry } from "../src/erc8004/ReputationRegistry.sol";

contract ReputationRegistryTest is Test {
    IdentityRegistry id;
    ReputationRegistry rep;

    address agentOwner = makeAddr("agentOwner");
    address clientA = makeAddr("clientA");
    address clientB = makeAddr("clientB");
    uint256 agentId;

    function setUp() public {
        id = new IdentityRegistry();
        rep = new ReputationRegistry(address(id));
        vm.prank(agentOwner);
        agentId = id.register("ipfs://agent");
    }

    function test_thirdPartyFeedback() public {
        vm.prank(clientA);
        rep.giveFeedback(agentId, 90, 0, "alpha", "meth", "settle", "ipfs://f", keccak256("h"));

        assertEq(rep.getLastIndex(agentId, clientA), 1);
        (int128 v, uint8 d, string memory t1,, bool revoked) = rep.readFeedback(agentId, clientA, 0);
        assertEq(v, 90);
        assertEq(d, 0);
        assertEq(t1, "alpha");
        assertFalse(revoked);

        address[] memory clients = rep.getClients(agentId);
        assertEq(clients.length, 1);
        assertEq(clients[0], clientA);
    }

    function test_revert_selfFeedbackForbidden() public {
        vm.prank(agentOwner);
        vm.expectRevert(
            abi.encodeWithSelector(ReputationRegistry.SelfFeedbackForbidden.selector, agentId, agentOwner)
        );
        rep.giveFeedback(agentId, 100, 0, "alpha", "", "", "", bytes32(0));
    }

    function test_revert_unknownAgent() public {
        vm.prank(clientA);
        vm.expectRevert(abi.encodeWithSelector(ReputationRegistry.UnknownAgent.selector, 999));
        rep.giveFeedback(999, 1, 0, "x", "", "", "", bytes32(0));
    }

    function test_summary_averagesMatchingTags() public {
        vm.prank(clientA);
        rep.giveFeedback(agentId, 80, 0, "alpha", "", "", "", bytes32(0));
        vm.prank(clientB);
        rep.giveFeedback(agentId, 100, 0, "alpha", "", "", "", bytes32(0));

        address[] memory none = new address[](0);
        (uint64 count, int128 avg,) = rep.getSummary(agentId, none, "alpha", "");
        assertEq(count, 2);
        assertEq(avg, 90);

        (uint64 c2,,) = rep.getSummary(agentId, none, "nonexistent-tag", "");
        assertEq(c2, 0);
    }

    function test_revoke_excludesFromSummary() public {
        vm.prank(clientA);
        rep.giveFeedback(agentId, 50, 0, "alpha", "", "", "", bytes32(0));
        vm.prank(clientA);
        rep.revokeFeedback(agentId, 0);

        (,,,, bool revoked) = rep.readFeedback(agentId, clientA, 0);
        assertTrue(revoked);

        address[] memory none = new address[](0);
        (uint64 count,,) = rep.getSummary(agentId, none, "alpha", "");
        assertEq(count, 0);
    }

    function test_getIdentityRegistry() public view {
        assertEq(rep.getIdentityRegistry(), address(id));
    }
}
