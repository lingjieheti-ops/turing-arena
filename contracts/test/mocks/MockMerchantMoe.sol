// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ILBQuoter, ILBRouter } from "../../src/interfaces/IMerchantMoe.sol";

/// @dev Merchant Moe interface-compatible quoter for tests/testnet. `price` is
///      quote-token out per 1e18 base in.
contract MockLBQuoter is ILBQuoter {
    uint256 public price = 3000e18;

    function setPrice(uint256 p) external {
        price = p;
    }

    function findBestPathFromAmountIn(address[] memory route, uint128 amountIn)
        external
        view
        override
        returns (Quote memory q)
    {
        uint256 n = route.length;
        q.route = route;
        q.amounts = new uint128[](n);
        q.amounts[0] = amountIn;
        q.amounts[n - 1] = uint128((uint256(amountIn) * price) / 1e18);
        return q;
    }
}

/// @dev Merchant Moe interface-compatible router for tests/testnet. Swaps at a flat
///      `rate` (amountOut = amountIn * rate / 1e18) and pays out of its own balance,
///      so seed it with the output token in tests. Mirrors the real LBRouter surface.
contract MockLBRouter is ILBRouter {
    uint256 public rate = 1e18; // 1:1 by default

    function setRate(uint256 r) external {
        rate = r;
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        Path memory path,
        address to,
        uint256
    ) external override returns (uint256 amountOut) {
        IERC20 tokenIn = path.tokenPath[0];
        IERC20 tokenOut = path.tokenPath[path.tokenPath.length - 1];
        require(tokenIn.transferFrom(msg.sender, address(this), amountIn), "in");
        amountOut = (amountIn * rate) / 1e18;
        require(amountOut >= amountOutMin, "slippage");
        require(tokenOut.transfer(to, amountOut), "out");
    }
}
