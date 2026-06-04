// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { IdentityRegistry } from "../src/erc8004/IdentityRegistry.sol";
import { MetadataEntry } from "../src/erc8004/IERC8004.sol";

contract IdentityRegistryTest is Test {
    IdentityRegistry id;

    bytes32 constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 nonce,uint256 deadline)");
    bytes32 constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    address owner = makeAddr("owner");

    function setUp() public {
        id = new IdentityRegistry();
    }

    function test_register_incrementsIdsFromOne() public {
        vm.prank(owner);
        uint256 a = id.register("ipfs://a");
        vm.prank(owner);
        uint256 b = id.register("ipfs://b");
        assertEq(a, 1);
        assertEq(b, 2);
        assertEq(id.totalAgents(), 2);
        assertEq(id.ownerOf(a), owner);
        assertEq(id.agentURI(a), "ipfs://a");
        assertEq(id.tokenURI(a), "ipfs://a");
    }

    function test_registerWithMetadata() public {
        MetadataEntry[] memory m = new MetadataEntry[](2);
        m[0] = MetadataEntry({ metadataKey: "type", metadataValue: bytes("AI") });
        m[1] = MetadataEntry({ metadataKey: "model", metadataValue: bytes("glm-4") });
        vm.prank(owner);
        uint256 a = id.register("ipfs://a", m);
        assertEq(string(id.getMetadata(a, "type")), "AI");
        assertEq(string(id.getMetadata(a, "model")), "glm-4");
    }

    function test_isController() public {
        vm.prank(owner);
        uint256 a = id.register("ipfs://a");
        assertTrue(id.isController(a, owner));
        assertFalse(id.isController(a, makeAddr("stranger")));
        assertFalse(id.isController(999, owner)); // unknown agent
    }

    function test_setAgentWallet_eip712() public {
        vm.prank(owner);
        uint256 a = id.register("ipfs://a");

        (address hot, uint256 hotPk) = makeAddrAndKey("hotwallet");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signWallet(hotPk, a, hot, id.walletNonce(a), deadline);

        vm.prank(owner);
        id.setAgentWallet(a, hot, deadline, sig);

        assertEq(id.getAgentWallet(a), hot);
        assertTrue(id.isController(a, hot), "hot wallet controls agent");
        assertTrue(id.isController(a, owner), "owner still controls");
        assertEq(id.walletNonce(a), 1, "nonce advanced");
    }

    function test_revert_setAgentWallet_wrongSigner() public {
        vm.prank(owner);
        uint256 a = id.register("ipfs://a");

        address hot = makeAddr("hot");
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        uint256 deadline = block.timestamp + 1 days;
        // attacker signs instead of `hot`
        bytes memory sig = _signWallet(attackerPk, a, hot, 0, deadline);

        vm.prank(owner);
        vm.expectRevert();
        id.setAgentWallet(a, hot, deadline, sig);
    }

    function test_revert_onlyOwnerBindsWallet() public {
        vm.prank(owner);
        uint256 a = id.register("ipfs://a");
        (address hot, uint256 hotPk) = makeAddrAndKey("hot");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory sig = _signWallet(hotPk, a, hot, 0, deadline);

        vm.prank(makeAddr("stranger"));
        vm.expectRevert(
            abi.encodeWithSelector(IdentityRegistry.NotController.selector, a, makeAddr("stranger"))
        );
        id.setAgentWallet(a, hot, deadline, sig);
    }

    function _signWallet(uint256 pk, uint256 agentId, address newWallet, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("IdentityRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(id)
            )
        );
        bytes32 structHash = keccak256(abi.encode(SET_WALLET_TYPEHASH, agentId, newWallet, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }
}
