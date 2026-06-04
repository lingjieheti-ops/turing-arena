// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Merchant Moe (Trader Joe Liquidity Book v2.2 fork on Mantle) — minimal surface
/// @notice Just what Turing Arena needs: quote a price (LBQuoter) and execute a
///         swap (LBRouter). Enums encode as uint8 so this is ABI-compatible with
///         the canonical contracts.
///         Mantle mainnet: LBRouter 0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a,
///                         LBQuoter 0x501b8AFd35df20f531fF45F6f695793AC3316c85,
///                         LBFactory 0xa6630671775c4EA2743840F9A5016dCf2A104054.

enum LBVersion {
    V1,
    V2,
    V2_1,
    V2_2
}

interface ILBRouter {
    struct Path {
        uint256[] pairBinSteps;
        LBVersion[] versions;
        IERC20[] tokenPath;
    }

    /// @notice Swap an exact `amountIn` along `path`, requiring at least `amountOutMin` out.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256 deadline
    ) external returns (uint256 amountOut);
}

interface ILBQuoter {
    struct Quote {
        address[] route;
        address[] pairs;
        uint256[] binSteps;
        LBVersion[] versions;
        uint128[] amounts;
        uint128[] virtualAmountsWithoutSlippage;
        uint128[] fees;
    }

    /// @notice Best path quote for swapping `amountIn` of route[0] into route[last].
    ///         amounts[0] == amountIn, amounts[last] == amountOut.
    function findBestPathFromAmountIn(address[] memory route, uint128 amountIn)
        external
        view
        returns (Quote memory);
}
