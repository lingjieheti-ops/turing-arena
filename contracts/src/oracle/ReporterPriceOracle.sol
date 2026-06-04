// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPriceOracle } from "./IPriceOracle.sol";

/// @title ReporterPriceOracle — permissioned push oracle
/// @notice Authorized reporters push USD prices on-chain (1e8 scaled). In Turing
///         Arena the reporter is an off-chain process that reads a robust truth
///         source — an Allora Network inference, a Merchant Moe / Agni TWAP, or a
///         CEX mid — and posts it. Every push is an event, so settlement prices
///         are fully auditable. Swap this for a Chainlink adapter in prod with no
///         change to the Arena (both satisfy `IPriceOracle`).
contract ReporterPriceOracle is IPriceOracle, Ownable {
    uint8 public constant override decimals = 8;

    struct Observation {
        uint256 price;
        uint256 updatedAt;
        string source; // e.g. "allora:topic-1", "merchant-moe:twap"
    }

    mapping(bytes32 => Observation) private _obs;
    mapping(address => bool) public isReporter;

    event ReporterSet(address indexed reporter, bool allowed);
    event PriceReported(bytes32 indexed asset, uint256 price, string source, address indexed reporter);

    error NotReporter(address caller);
    error ZeroPrice();

    constructor(address initialOwner) Ownable(initialOwner) {
        isReporter[initialOwner] = true;
        emit ReporterSet(initialOwner, true);
    }

    modifier onlyReporter() {
        if (!isReporter[msg.sender]) revert NotReporter(msg.sender);
        _;
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        isReporter[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    /// @notice Push a price for `asset` (USD, 1e8 scaled) with a provenance tag.
    function reportPrice(bytes32 asset, uint256 price, string calldata source) public onlyReporter {
        if (price == 0) revert ZeroPrice();
        _obs[asset] = Observation({ price: price, updatedAt: block.timestamp, source: source });
        emit PriceReported(asset, price, source, msg.sender);
    }

    /// @notice Batch variant for posting multiple assets in one tx.
    function reportPrices(bytes32[] calldata assets, uint256[] calldata prices, string calldata source)
        external
        onlyReporter
    {
        require(assets.length == prices.length, "length");
        for (uint256 i; i < assets.length; ++i) {
            reportPrice(assets[i], prices[i], source);
        }
    }

    /// @inheritdoc IPriceOracle
    function getPrice(bytes32 asset) external view override returns (uint256 price, uint256 updatedAt) {
        Observation storage o = _obs[asset];
        return (o.price, o.updatedAt);
    }

    /// @notice Full observation including provenance string.
    function getObservation(bytes32 asset) external view returns (Observation memory) {
        return _obs[asset];
    }
}
