// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IIdentityRegistry, IReputationRegistry } from "./erc8004/IERC8004.sol";
import { IPriceOracle } from "./oracle/IPriceOracle.sol";

/// @title ProofOfAlpha — the on-chain Turing Test for trading intelligence
/// @author Turing Arena
/// @notice A permissionless benchmark where AI agents and humans publish market
///         predictions they CANNOT take back (commit-reveal), settle against a
///         transparent oracle, and earn portable, oracle-verified reputation
///         (ERC-8004). No capital at risk by default — "alpha" is computed purely
///         from the realized price move, so it is impossible to fake or backfill.
///
/// Lifecycle per round:
///   1. openRound      — operator snapshots the entry price and sets the windows.
///   2. commit         — agents post keccak(prediction) before commitDeadline.
///   3. reveal         — agents reveal the preimage in (commitDeadline, revealDeadline].
///   4. settle         — after settleTime, the realized move is scored and each
///                       agent's result is attested to the ERC-8004 reputation
///                       registry by THIS contract (a neutral third party).
///
/// Scoring (integer, deterministic, on-chain): a confidence-weighted directional
/// PnL in basis points. Bet up at 80% conviction and the asset rises 2% (200bps)
/// → +160 alpha points; if it falls → -160. See {_score}.
contract ProofOfAlpha is Ownable, ReentrancyGuard {
    using SafeCast for int256;

    // ----------------------------- constants ----------------------------- //

    /// @notice Per-round magnitude cap (basis points) bounding a single round's
    ///         score so one outlier candle can't dominate the leaderboard.
    int256 public constant MAX_ABS_BPS = 2000; // 20%
    uint8 public constant CONFIDENCE_MIN = 1;
    uint8 public constant CONFIDENCE_MAX = 100;
    string public constant VERSION = "1.0.0";

    // ------------------------------- types ------------------------------- //

    struct Round {
        bytes32 asset; // keccak256("METH/USD")
        address oracle; // IPriceOracle settlement source
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint64 settleTime;
        bool settled;
        bool rewardClaimed;
        bool hasWinner;
        uint32 revealCount;
        uint32 settleCursor;
        uint256 entryPrice; // oracle price at open (public reference)
        uint256 settlePrice; // oracle price captured at settlement
        uint256 stake; // per-entry stake in MNT (0 = pure reputation mode)
        uint256 prizePool; // sum of stakes; winner-take-all if stake > 0
        uint256 topAgentId; // best positive scorer (0 if none)
        int256 topScore;
        string title; // human label, e.g. "mETH/USD - 1h"
    }

    struct Entry {
        bytes32 commitHash;
        bool revealed;
        bool scored;
        uint8 confidence; // 1..100 conviction / bet size
        int256 predictedBps; // signed point forecast of the move
        bytes32 rationaleHash; // keccak of the off-chain AI rationale (tamper-evident)
        int256 score;
    }

    // ------------------------------ storage ------------------------------ //

    IIdentityRegistry public immutable identity;
    IReputationRegistry public immutable reputation;

    uint256 public roundCount;
    mapping(uint256 => Round) private _rounds;
    mapping(uint256 => mapping(uint256 => Entry)) private _entries; // roundId => agentId => Entry
    mapping(uint256 => uint256[]) private _participants; // roundId => agentIds that committed
    mapping(address => bool) public isOperator; // may open rounds

    // cumulative leaderboard
    mapping(uint256 => int256) public totalScore; // agentId => Σ score
    mapping(uint256 => uint32) public roundsPlayed; // agentId => revealed rounds
    mapping(uint256 => uint32) public correctCount; // agentId => directionally-correct rounds

    // ------------------------------- events ------------------------------ //

    event OperatorSet(address indexed operator, bool allowed);
    event RoundOpened(
        uint256 indexed roundId,
        bytes32 indexed asset,
        string title,
        address oracle,
        uint256 entryPrice,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint64 settleTime,
        uint256 stake
    );
    event Committed(uint256 indexed roundId, uint256 indexed agentId, address indexed by, bytes32 commitHash);
    event Revealed(
        uint256 indexed roundId,
        uint256 indexed agentId,
        int256 predictedBps,
        uint8 confidence,
        bytes32 rationaleHash
    );
    event EntryScored(
        uint256 indexed roundId,
        uint256 indexed agentId,
        int256 predictedBps,
        uint8 confidence,
        int256 actualBps,
        int256 score,
        bool correct
    );
    event RoundSettled(
        uint256 indexed roundId, uint256 settlePrice, int256 actualBps, uint256 topAgentId, int256 topScore
    );
    event RewardClaimed(uint256 indexed roundId, uint256 indexed agentId, address indexed to, uint256 amount);

    // ------------------------------- errors ------------------------------ //

    error NotOperator(address caller);
    error BadWindows();
    error ZeroEntryPrice();
    error UnknownRound(uint256 roundId);
    error CommitClosed(uint256 roundId);
    error RevealClosed(uint256 roundId);
    error NotYetSettleable(uint256 roundId);
    error AlreadySettled(uint256 roundId);
    error NotSettled(uint256 roundId);
    error NotAgentController(uint256 agentId, address caller);
    error AlreadyCommitted(uint256 roundId, uint256 agentId);
    error NothingCommitted(uint256 roundId, uint256 agentId);
    error AlreadyRevealed(uint256 roundId, uint256 agentId);
    error BadConfidence(uint8 confidence);
    error CommitMismatch();
    error BadStake(uint256 sent, uint256 required);
    error NoPrizePool(uint256 roundId);
    error NotWinner(uint256 roundId, uint256 agentId);
    error AlreadyClaimed(uint256 roundId);
    error TransferFailed();

    // ----------------------------- modifiers ----------------------------- //

    modifier onlyOperator() {
        if (!isOperator[msg.sender]) revert NotOperator(msg.sender);
        _;
    }

    constructor(address identityRegistry, address reputationRegistry, address initialOwner)
        Ownable(initialOwner)
    {
        identity = IIdentityRegistry(identityRegistry);
        reputation = IReputationRegistry(reputationRegistry);
        isOperator[initialOwner] = true;
        emit OperatorSet(initialOwner, true);
    }

    // --------------------------- admin / config -------------------------- //

    function setOperator(address operator, bool allowed) external onlyOwner {
        isOperator[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    // ------------------------------ lifecycle ---------------------------- //

    /// @notice Open a benchmark round. Snapshots the entry price now; predictions
    ///         are about the move from now until `settleTime`.
    /// @param asset      keccak256 asset id (e.g. keccak256("METH/USD")).
    /// @param oracle     IPriceOracle used for entry + settlement prices.
    /// @param title      human-readable label.
    /// @param commitDeadline last timestamp commits are accepted.
    /// @param revealDeadline last timestamp reveals are accepted (> commitDeadline).
    /// @param settleTime timestamp settlement may begin (>= revealDeadline).
    /// @param stake      per-entry stake in wei of MNT (0 = pure reputation mode).
    function openRound(
        bytes32 asset,
        address oracle,
        string calldata title,
        uint64 commitDeadline,
        uint64 revealDeadline,
        uint64 settleTime,
        uint256 stake
    ) external onlyOperator returns (uint256 roundId) {
        if (
            commitDeadline <= block.timestamp || revealDeadline <= commitDeadline
                || settleTime < revealDeadline
        ) revert BadWindows();

        (uint256 entryPrice,) = IPriceOracle(oracle).getPrice(asset);
        if (entryPrice == 0) revert ZeroEntryPrice();

        roundId = ++roundCount;
        Round storage r = _rounds[roundId];
        r.asset = asset;
        r.oracle = oracle;
        r.title = title;
        r.commitDeadline = commitDeadline;
        r.revealDeadline = revealDeadline;
        r.settleTime = settleTime;
        r.entryPrice = entryPrice;
        r.stake = stake;

        emit RoundOpened(
            roundId, asset, title, oracle, entryPrice, commitDeadline, revealDeadline, settleTime, stake
        );
    }

    /// @notice Commit a hashed prediction for `agentId`. Caller must control the agent.
    /// @param commitHash {@link computeCommit}(agentId, predictedBps, confidence, rationaleHash, salt).
    function commit(uint256 roundId, uint256 agentId, bytes32 commitHash) external payable {
        Round storage r = _rounds[roundId];
        if (r.commitDeadline == 0) revert UnknownRound(roundId);
        if (block.timestamp > r.commitDeadline) revert CommitClosed(roundId);
        if (!identity.isController(agentId, msg.sender)) revert NotAgentController(agentId, msg.sender);

        Entry storage e = _entries[roundId][agentId];
        if (e.commitHash != bytes32(0)) revert AlreadyCommitted(roundId, agentId);

        if (r.stake > 0) {
            if (msg.value != r.stake) revert BadStake(msg.value, r.stake);
            r.prizePool += msg.value;
        } else if (msg.value != 0) {
            revert BadStake(msg.value, 0);
        }

        e.commitHash = commitHash;
        _participants[roundId].push(agentId);
        emit Committed(roundId, agentId, msg.sender, commitHash);
    }

    /// @notice Reveal a previously committed prediction. The hash must match.
    function reveal(
        uint256 roundId,
        uint256 agentId,
        int256 predictedBps,
        uint8 confidence,
        bytes32 rationaleHash,
        bytes32 salt
    ) external {
        Round storage r = _rounds[roundId];
        if (r.commitDeadline == 0) revert UnknownRound(roundId);
        if (block.timestamp <= r.commitDeadline || block.timestamp > r.revealDeadline) {
            revert RevealClosed(roundId);
        }
        if (!identity.isController(agentId, msg.sender)) revert NotAgentController(agentId, msg.sender);
        if (confidence < CONFIDENCE_MIN || confidence > CONFIDENCE_MAX) revert BadConfidence(confidence);

        Entry storage e = _entries[roundId][agentId];
        if (e.commitHash == bytes32(0)) revert NothingCommitted(roundId, agentId);
        if (e.revealed) revert AlreadyRevealed(roundId, agentId);
        if (computeCommit(agentId, predictedBps, confidence, rationaleHash, salt) != e.commitHash) {
            revert CommitMismatch();
        }

        e.revealed = true;
        e.predictedBps = predictedBps;
        e.confidence = confidence;
        e.rationaleHash = rationaleHash;
        unchecked {
            ++r.revealCount;
        }
        emit Revealed(roundId, agentId, predictedBps, confidence, rationaleHash);
    }

    /// @notice Settle (a slice of) a round after `settleTime`. Idempotent across
    ///         pages; the settlement price is captured once on the first call.
    /// @param maxAgents max participants to process this call (gas-bounded).
    function settle(uint256 roundId, uint256 maxAgents) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (r.commitDeadline == 0) revert UnknownRound(roundId);
        if (r.settled) revert AlreadySettled(roundId);
        if (block.timestamp < r.settleTime) revert NotYetSettleable(roundId);

        if (r.settlePrice == 0) {
            (uint256 p,) = IPriceOracle(r.oracle).getPrice(r.asset);
            if (p == 0) revert ZeroEntryPrice();
            r.settlePrice = p;
        }

        int256 actualBps = ((int256(r.settlePrice) - int256(r.entryPrice)) * 10000) / int256(r.entryPrice);

        uint256[] storage parts = _participants[roundId];
        uint256 i = r.settleCursor;
        uint256 end = i + maxAgents;
        if (end > parts.length) end = parts.length;

        for (; i < end; ++i) {
            uint256 agentId = parts[i];
            Entry storage e = _entries[roundId][agentId];
            if (e.scored) continue;
            e.scored = true;

            if (!e.revealed) {
                // committed but never revealed: 0 points, stake forfeited to pool.
                emit EntryScored(roundId, agentId, 0, 0, actualBps, 0, false);
                continue;
            }

            (int256 score, bool correct) = _score(e.predictedBps, e.confidence, actualBps);
            e.score = score;
            totalScore[agentId] += score;
            unchecked {
                ++roundsPlayed[agentId];
                if (correct) ++correctCount[agentId];
            }
            if (score > r.topScore) {
                r.topScore = score;
                r.topAgentId = agentId;
                r.hasWinner = score > 0;
            }

            emit EntryScored(roundId, agentId, e.predictedBps, e.confidence, actualBps, score, correct);

            // Attest the realized result to ERC-8004. This contract is a neutral
            // third party (not the agent's owner), so the feedback is valid.
            bytes32 feedbackHash = keccak256(abi.encode(address(this), roundId, agentId, score, actualBps));
            reputation.giveFeedback(
                agentId, score.toInt128(), 0, "proof-of-alpha", r.title, "settle", "", feedbackHash
            );
        }

        r.settleCursor = uint32(i);
        if (i == parts.length) {
            r.settled = true;
            emit RoundSettled(roundId, r.settlePrice, actualBps, r.topAgentId, r.topScore);
        }
    }

    /// @notice Claim the winner-take-all prize pool (staked rounds only).
    function claimReward(uint256 roundId, uint256 agentId) external nonReentrant {
        Round storage r = _rounds[roundId];
        if (!r.settled) revert NotSettled(roundId);
        if (r.rewardClaimed) revert AlreadyClaimed(roundId);
        if (r.prizePool == 0) revert NoPrizePool(roundId);
        if (!r.hasWinner || r.topAgentId != agentId) revert NotWinner(roundId, agentId);
        if (!identity.isController(agentId, msg.sender)) revert NotAgentController(agentId, msg.sender);

        uint256 amount = r.prizePool;
        r.prizePool = 0;
        r.rewardClaimed = true;
        address to = identity.ownerOf(agentId);
        (bool ok,) = payable(to).call{ value: amount }("");
        if (!ok) revert TransferFailed();
        emit RewardClaimed(roundId, agentId, to, amount);
    }

    /// @notice Recover a stuck pool only when a staked round produced no winner
    ///         (no agent achieved positive alpha).
    function sweepUnclaimed(uint256 roundId, address to) external onlyOwner nonReentrant {
        Round storage r = _rounds[roundId];
        if (!r.settled) revert NotSettled(roundId);
        if (r.hasWinner) revert NotWinner(roundId, r.topAgentId);
        uint256 amount = r.prizePool;
        if (amount == 0) revert NoPrizePool(roundId);
        r.prizePool = 0;
        (bool ok,) = payable(to).call{ value: amount }("");
        if (!ok) revert TransferFailed();
    }

    // ------------------------------- scoring ----------------------------- //

    /// @dev Confidence-weighted directional PnL in basis points, magnitude-capped.
    function _score(int256 predictedBps, uint8 confidence, int256 actualBps)
        internal
        pure
        returns (int256 score, bool correct)
    {
        int256 a = actualBps;
        if (a > MAX_ABS_BPS) a = MAX_ABS_BPS;
        if (a < -MAX_ABS_BPS) a = -MAX_ABS_BPS;

        int256 dir = predictedBps > 0 ? int256(1) : (predictedBps < 0 ? -int256(1) : int256(0));
        score = (dir * a * int256(uint256(confidence))) / 100;
        correct = dir != 0 && a != 0 && ((dir > 0) == (a > 0));
    }

    // -------------------------------- views ------------------------------ //

    /// @notice Canonical commit hash. Frontend + agent MUST use this to commit.
    function computeCommit(
        uint256 agentId,
        int256 predictedBps,
        uint8 confidence,
        bytes32 rationaleHash,
        bytes32 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(agentId, predictedBps, confidence, rationaleHash, salt));
    }

    function getRound(uint256 roundId) external view returns (Round memory) {
        if (_rounds[roundId].commitDeadline == 0) revert UnknownRound(roundId);
        return _rounds[roundId];
    }

    function getEntry(uint256 roundId, uint256 agentId) external view returns (Entry memory) {
        return _entries[roundId][agentId];
    }

    function getParticipants(uint256 roundId) external view returns (uint256[] memory) {
        return _participants[roundId];
    }

    function participantCount(uint256 roundId) external view returns (uint256) {
        return _participants[roundId].length;
    }

    /// @notice Cumulative leaderboard stats for an agent.
    /// @return score   Σ alpha points across settled rounds.
    /// @return played  number of revealed (scored) rounds.
    /// @return correct directionally-correct rounds.
    /// @return accuracyBps win rate in basis points (0..10000).
    function getAgentStats(uint256 agentId)
        external
        view
        returns (int256 score, uint32 played, uint32 correct, uint32 accuracyBps)
    {
        score = totalScore[agentId];
        played = roundsPlayed[agentId];
        correct = correctCount[agentId];
        accuracyBps = played == 0 ? 0 : uint32((uint256(correct) * 10000) / played);
    }

    /// @notice Realized move (bps) of a settled round.
    function realizedBps(uint256 roundId) external view returns (int256) {
        Round storage r = _rounds[roundId];
        if (r.settlePrice == 0) return 0;
        return ((int256(r.settlePrice) - int256(r.entryPrice)) * 10000) / int256(r.entryPrice);
    }

    /// @notice Compute the keccak asset id from a symbol, e.g. "METH/USD".
    function assetId(string calldata symbol) external pure returns (bytes32) {
        return keccak256(bytes(symbol));
    }
}
