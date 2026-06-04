// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ILBQuoter } from "../interfaces/IMerchantMoe.sol";
import { IPriceOracle } from "./IPriceOracle.sol";

/// @title MantleDexOracle — settlement prices sourced from Merchant Moe (Mantle DeFi)
/// @notice Reads a live price for an arena asset by quoting a token route through
///         Merchant Moe's LBQuoter. This makes settlement depend on REAL Mantle
///         on-chain liquidity (the AI Alpha & Data track requires "Mantle on-chain
///         data as a core source"), not an off-chain feed. Read-only + view, so no
///         capital or trust assumptions beyond the DEX itself.
/// @dev    Deploy on Mantle mainnet against the canonical LBQuoter; on testnet point
///         it at a MockLBQuoter so the same path is exercised end-to-end.
contract MantleDexOracle is IPriceOracle, Ownable {
    uint8 public constant override decimals = 8;

    ILBQuoter public immutable quoter;

    struct Route {
        address[] path; // [base, ..., quote] token addresses, e.g. [mETH, USDY]
        uint128 amountIn; // 1 whole base token, e.g. 1e18
        uint8 quoteDecimals; // decimals of the quote (final) token
        bool set;
    }

    mapping(bytes32 => Route) private _routes;

    event RouteSet(bytes32 indexed asset, address[] path, uint128 amountIn, uint8 quoteDecimals);

    error NoRoute(bytes32 asset);
    error EmptyQuote();

    constructor(address quoter_, address owner_) Ownable(owner_) {
        quoter = ILBQuoter(quoter_);
    }

    /// @notice Configure how `asset` is priced: a Merchant Moe token route + the
    ///         base amountIn (1 whole base token) + the quote token's decimals.
    function setRoute(bytes32 asset, address[] calldata path, uint128 amountIn, uint8 quoteDecimals)
        external
        onlyOwner
    {
        require(path.length >= 2 && amountIn > 0, "bad route");
        _routes[asset] = Route({ path: path, amountIn: amountIn, quoteDecimals: quoteDecimals, set: true });
        emit RouteSet(asset, path, amountIn, quoteDecimals);
    }

    /// @inheritdoc IPriceOracle
    function getPrice(bytes32 asset) external view override returns (uint256 price, uint256 updatedAt) {
        Route storage r = _routes[asset];
        if (!r.set) revert NoRoute(asset);
        ILBQuoter.Quote memory q = quoter.findBestPathFromAmountIn(r.path, r.amountIn);
        uint256 n = q.amounts.length;
        if (n == 0) revert EmptyQuote();
        uint256 out = uint256(q.amounts[n - 1]); // quote-token out for 1 base token in
        // Normalize to 1e8 USD. amountIn is 1 whole base token, so `out` already
        // represents price * 10**quoteDecimals.
        price = (out * 1e8) / (10 ** r.quoteDecimals);
        updatedAt = block.timestamp;
    }

    function getRoute(bytes32 asset) external view returns (Route memory) {
        return _routes[asset];
    }
}
