// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IIdentityRegistry, MetadataEntry } from "./IERC8004.sol";

/// @title IdentityRegistry — ERC-8004 agent identity (ERC-721)
/// @notice Each agent is a soul-ish NFT (`agentId`) owned by its creator. The
///         creator may bind a separate operational "agent wallet" via an
///         EIP-712 signature from that wallet (proving control), so an autonomous
///         hot wallet can act on-chain without holding the identity NFT.
/// @dev Reference, audited-pattern implementation. Faithful to EIP-8004.
contract IdentityRegistry is ERC721, EIP712, IIdentityRegistry {
    bytes32 private constant _SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 nonce,uint256 deadline)");

    uint256 private _nextId;

    mapping(uint256 => string) private _agentURI;
    mapping(uint256 => mapping(bytes32 => bytes)) private _metadata;
    mapping(uint256 => address) private _agentWallet;
    mapping(uint256 => uint256) private _walletNonce;

    error NotController(uint256 agentId, address caller);
    error UnknownAgent(uint256 agentId);
    error SignatureExpired(uint256 deadline);
    error InvalidWalletSignature(address expected, address recovered);
    error ZeroWallet();

    constructor() ERC721("Turing Arena Agent", "AGENT") EIP712("IdentityRegistry", "1") { }

    // --------------------------------------------------------------------- //
    //                              Registration                             //
    // --------------------------------------------------------------------- //

    /// @inheritdoc IIdentityRegistry
    function register(string calldata uri, MetadataEntry[] calldata metadata)
        external
        override
        returns (uint256 agentId)
    {
        agentId = _register(uri);
        uint256 len = metadata.length;
        for (uint256 i; i < len; ++i) {
            _setMetadata(agentId, metadata[i].metadataKey, metadata[i].metadataValue);
        }
    }

    /// @inheritdoc IIdentityRegistry
    function register(string calldata uri) external override returns (uint256 agentId) {
        agentId = _register(uri);
    }

    /// @inheritdoc IIdentityRegistry
    function register() external override returns (uint256 agentId) {
        agentId = _register("");
    }

    function _register(string memory uri) internal returns (uint256 agentId) {
        unchecked {
            agentId = ++_nextId;
        }
        _mint(msg.sender, agentId);
        _agentURI[agentId] = uri;
        emit Registered(agentId, uri, msg.sender);
    }

    // --------------------------------------------------------------------- //
    //                                 URI                                   //
    // --------------------------------------------------------------------- //

    /// @inheritdoc IIdentityRegistry
    function setAgentURI(uint256 agentId, string calldata newURI) external override {
        _requireController(agentId, msg.sender);
        _agentURI[agentId] = newURI;
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /// @inheritdoc IIdentityRegistry
    function agentURI(uint256 agentId) public view override returns (string memory) {
        _requireExists(agentId);
        return _agentURI[agentId];
    }

    /// @notice The agent card URI doubles as the ERC-721 tokenURI for wallet display.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _agentURI[tokenId];
    }

    // --------------------------------------------------------------------- //
    //                               Metadata                                //
    // --------------------------------------------------------------------- //

    /// @inheritdoc IIdentityRegistry
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external override {
        _requireController(agentId, msg.sender);
        _setMetadata(agentId, key, value);
    }

    function _setMetadata(uint256 agentId, string memory key, bytes memory value) internal {
        _metadata[agentId][keccak256(bytes(key))] = value;
        emit MetadataSet(agentId, key, key, value);
    }

    /// @inheritdoc IIdentityRegistry
    function getMetadata(uint256 agentId, string calldata key) external view override returns (bytes memory) {
        _requireExists(agentId);
        return _metadata[agentId][keccak256(bytes(key))];
    }

    // --------------------------------------------------------------------- //
    //                            Agent wallet binding                       //
    // --------------------------------------------------------------------- //

    /// @inheritdoc IIdentityRegistry
    /// @dev Owner submits; `newWallet` must have signed the EIP-712 payload over
    ///      {agentId, newWallet, nonce, deadline}, proving it controls the key.
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature)
        external
        override
    {
        if (msg.sender != ownerOf(agentId)) revert NotController(agentId, msg.sender);
        if (newWallet == address(0)) revert ZeroWallet();
        if (block.timestamp > deadline) revert SignatureExpired(deadline);

        bytes32 structHash =
            keccak256(abi.encode(_SET_WALLET_TYPEHASH, agentId, newWallet, _walletNonce[agentId], deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        if (signer != newWallet) revert InvalidWalletSignature(newWallet, signer);

        unchecked {
            ++_walletNonce[agentId];
        }
        _agentWallet[agentId] = newWallet;
        emit AgentWalletSet(agentId, newWallet);
    }

    /// @inheritdoc IIdentityRegistry
    function unsetAgentWallet(uint256 agentId) external override {
        if (msg.sender != ownerOf(agentId)) revert NotController(agentId, msg.sender);
        _agentWallet[agentId] = address(0);
        emit AgentWalletSet(agentId, address(0));
    }

    /// @inheritdoc IIdentityRegistry
    function getAgentWallet(uint256 agentId) external view override returns (address) {
        return _agentWallet[agentId];
    }

    /// @notice Nonce consumed by the next `setAgentWallet` for `agentId`.
    function walletNonce(uint256 agentId) external view returns (uint256) {
        return _walletNonce[agentId];
    }

    // --------------------------------------------------------------------- //
    //                                 Views                                 //
    // --------------------------------------------------------------------- //

    /// @inheritdoc IIdentityRegistry
    function isController(uint256 agentId, address account) public view override returns (bool) {
        if (_ownerOf(agentId) == address(0)) return false;
        return account == _ownerOf(agentId) || account == _agentWallet[agentId];
    }

    /// @inheritdoc IIdentityRegistry
    function exists(uint256 agentId) public view override returns (bool) {
        return _ownerOf(agentId) != address(0);
    }

    function ownerOf(uint256 agentId) public view override(ERC721, IIdentityRegistry) returns (address) {
        return super.ownerOf(agentId);
    }

    /// @notice Total agents ever registered (ids are 1..totalAgents).
    function totalAgents() external view returns (uint256) {
        return _nextId;
    }

    // --------------------------------------------------------------------- //
    //                               Internals                               //
    // --------------------------------------------------------------------- //

    function _requireExists(uint256 agentId) internal view {
        if (_ownerOf(agentId) == address(0)) revert UnknownAgent(agentId);
    }

    function _requireController(uint256 agentId, address account) internal view {
        if (!isController(agentId, account)) revert NotController(agentId, account);
    }
}
