// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IPriceOracle — pluggable settlement price source for the Arena
/// @notice Returns a USD price for an asset key, scaled to `decimals()` (1e8,
///         Chainlink-style). Implementations may wrap a push reporter (Allora
///         network inference / a DEX TWAP / a real feed) or a mock for tests.
///         The Arena only depends on this minimal surface, so the truth source
///         can be swapped without touching settlement logic.
interface IPriceOracle {
    /// @param asset keccak-style asset id, e.g. keccak256("METH/USD").
    /// @return price USD price scaled by `decimals()`.
    /// @return updatedAt unix timestamp the price was last set.
    function getPrice(bytes32 asset) external view returns (uint256 price, uint256 updatedAt);

    /// @return Fixed-point decimals of the returned price (8).
    function decimals() external view returns (uint8);
}
