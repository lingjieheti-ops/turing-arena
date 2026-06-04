// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC-8004 "Trustless Agents" interfaces
/// @notice Faithful interface transcription of EIP-8004 (Identity + Reputation
///         registries). See https://eips.ethereum.org/EIPS/eip-8004.
///         Implemented locally so Turing Arena is self-contained + verifiable on
///         Mantle Sepolia. In production these can point at the canonical Mantle
///         mainnet registries (Identity 0x8004A169..., Reputation 0x8004BAa1...).

/// @dev Key/value metadata attached to an agent identity at registration time.
struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}

/// @notice ERC-8004 Identity Registry. ERC-721 based; `agentId` == token id.
interface IIdentityRegistry {
    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(
        uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue
    );
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);

    function register(string calldata agentURI, MetadataEntry[] calldata metadata)
        external
        returns (uint256 agentId);
    function register(string calldata agentURI) external returns (uint256 agentId);
    function register() external returns (uint256 agentId);

    function setAgentURI(uint256 agentId, string calldata newURI) external;
    function agentURI(uint256 agentId) external view returns (string memory);

    function setMetadata(uint256 agentId, string calldata metadataKey, bytes calldata metadataValue) external;
    function getMetadata(uint256 agentId, string calldata metadataKey) external view returns (bytes memory);

    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature)
        external;
    function getAgentWallet(uint256 agentId) external view returns (address);
    function unsetAgentWallet(uint256 agentId) external;

    /// @notice Convenience: true if `account` owns or is the bound wallet of `agentId`.
    function isController(uint256 agentId, address account) external view returns (bool);
    function exists(uint256 agentId) external view returns (bool);
    function ownerOf(uint256 agentId) external view returns (address);
}

/// @notice ERC-8004 Reputation Registry. Feedback authors MUST NOT be the agent
///         owner/operator — keeping reputation third-party attested.
interface IReputationRegistry {
    event NewFeedback(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        int128 value,
        uint8 valueDecimals,
        string indexed indexedTag1,
        string tag1,
        string tag2,
        string endpoint,
        string feedbackURI,
        bytes32 feedbackHash
    );
    event FeedbackRevoked(
        uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex
    );
    event ResponseAppended(
        uint256 indexed agentId,
        address indexed clientAddress,
        uint64 feedbackIndex,
        address indexed responder,
        string responseURI,
        bytes32 responseHash
    );

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external;

    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external;

    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals);

    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked);

    function getClients(uint256 agentId) external view returns (address[] memory);
    function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64);
    function getIdentityRegistry() external view returns (address);
}
