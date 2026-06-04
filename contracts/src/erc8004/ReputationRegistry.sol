// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IIdentityRegistry, IReputationRegistry } from "./IERC8004.sol";

/// @title ReputationRegistry — ERC-8004 third-party reputation
/// @notice Anyone who is NOT the agent's owner/operator may attest feedback about
///         an agent. In Turing Arena the neutral `ProofOfAlpha` contract is the
///         attestor: it writes each agent's realized, oracle-settled performance
///         here, producing a portable on-chain reputation that no one can fake.
/// @dev Faithful to EIP-8004 reputation semantics.
contract ReputationRegistry is IReputationRegistry {
    struct Feedback {
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
        string endpoint;
        bytes32 feedbackHash;
        bool isRevoked;
    }

    IIdentityRegistry public immutable identity;

    mapping(uint256 => mapping(address => Feedback[])) private _feedback;
    mapping(uint256 => address[]) private _clients;
    mapping(uint256 => mapping(address => bool)) private _isClient;

    error UnknownAgent(uint256 agentId);
    error SelfFeedbackForbidden(uint256 agentId, address caller);
    error NoSuchFeedback(uint256 agentId, address client, uint64 index);
    error AlreadyRevoked(uint256 agentId, address client, uint64 index);
    error NotFeedbackAuthor(address caller);
    error NotAgentController(uint256 agentId, address caller);

    constructor(address identityRegistry) {
        identity = IIdentityRegistry(identityRegistry);
    }

    /// @inheritdoc IReputationRegistry
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external override {
        if (!identity.exists(agentId)) revert UnknownAgent(agentId);
        // Reputation must be third-party: the agent's own owner/operator cannot
        // attest about itself.
        if (identity.isController(agentId, msg.sender)) revert SelfFeedbackForbidden(agentId, msg.sender);

        Feedback[] storage arr = _feedback[agentId][msg.sender];
        uint64 index = uint64(arr.length);
        arr.push(
            Feedback({
                value: value,
                valueDecimals: valueDecimals,
                tag1: tag1,
                tag2: tag2,
                endpoint: endpoint,
                feedbackHash: feedbackHash,
                isRevoked: false
            })
        );

        if (!_isClient[agentId][msg.sender]) {
            _isClient[agentId][msg.sender] = true;
            _clients[agentId].push(msg.sender);
        }

        emit NewFeedback(
            agentId,
            msg.sender,
            index,
            value,
            valueDecimals,
            tag1,
            tag1,
            tag2,
            endpoint,
            feedbackURI,
            feedbackHash
        );
    }

    /// @inheritdoc IReputationRegistry
    function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external override {
        Feedback[] storage arr = _feedback[agentId][msg.sender];
        if (feedbackIndex >= arr.length) revert NoSuchFeedback(agentId, msg.sender, feedbackIndex);
        if (arr[feedbackIndex].isRevoked) revert AlreadyRevoked(agentId, msg.sender, feedbackIndex);
        arr[feedbackIndex].isRevoked = true;
        emit FeedbackRevoked(agentId, msg.sender, feedbackIndex);
    }

    /// @inheritdoc IReputationRegistry
    function appendResponse(
        uint256 agentId,
        address clientAddress,
        uint64 feedbackIndex,
        string calldata responseURI,
        bytes32 responseHash
    ) external override {
        if (!identity.isController(agentId, msg.sender)) {
            revert NotAgentController(agentId, msg.sender);
        }
        if (feedbackIndex >= _feedback[agentId][clientAddress].length) {
            revert NoSuchFeedback(agentId, clientAddress, feedbackIndex);
        }
        emit ResponseAppended(agentId, clientAddress, feedbackIndex, msg.sender, responseURI, responseHash);
    }

    /// @inheritdoc IReputationRegistry
    function getSummary(
        uint256 agentId,
        address[] calldata clientAddresses,
        string calldata tag1,
        string calldata tag2
    ) external view override returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals) {
        address[] memory clients;
        if (clientAddresses.length > 0) {
            clients = clientAddresses;
        } else {
            clients = _clients[agentId];
        }
        int256 sum;
        uint256 n;
        uint8 decimals;
        for (uint256 i; i < clients.length; ++i) {
            Feedback[] storage arr = _feedback[agentId][clients[i]];
            for (uint256 j; j < arr.length; ++j) {
                Feedback storage fb = arr[j];
                if (fb.isRevoked) continue;
                if (!_matches(tag1, fb.tag1) || !_matches(tag2, fb.tag2)) continue;
                sum += int256(fb.value);
                decimals = fb.valueDecimals;
                unchecked {
                    ++n;
                }
            }
        }
        count = uint64(n);
        summaryValueDecimals = decimals;
        summaryValue = n == 0 ? int128(0) : int128(sum / int256(n));
    }

    /// @inheritdoc IReputationRegistry
    function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex)
        external
        view
        override
        returns (int128 value, uint8 valueDecimals, string memory tag1, string memory tag2, bool isRevoked)
    {
        Feedback[] storage arr = _feedback[agentId][clientAddress];
        if (feedbackIndex >= arr.length) revert NoSuchFeedback(agentId, clientAddress, feedbackIndex);
        Feedback storage fb = arr[feedbackIndex];
        return (fb.value, fb.valueDecimals, fb.tag1, fb.tag2, fb.isRevoked);
    }

    /// @inheritdoc IReputationRegistry
    function getClients(uint256 agentId) external view override returns (address[] memory) {
        return _clients[agentId];
    }

    /// @inheritdoc IReputationRegistry
    /// @return The number of feedback entries `clientAddress` has left for `agentId`
    ///         (i.e. the next write index). Iterate 0..(return-1) to read all.
    function getLastIndex(uint256 agentId, address clientAddress) external view override returns (uint64) {
        return uint64(_feedback[agentId][clientAddress].length);
    }

    /// @inheritdoc IReputationRegistry
    function getIdentityRegistry() external view override returns (address) {
        return address(identity);
    }

    function _matches(string calldata filter, string memory value) private pure returns (bool) {
        return bytes(filter).length == 0 || keccak256(bytes(filter)) == keccak256(bytes(value));
    }
}
