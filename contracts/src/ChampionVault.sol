// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ILBRouter, LBVersion } from "./interfaces/IMerchantMoe.sol";
import { ProofOfAlpha } from "./ProofOfAlpha.sol";

/// @title ChampionVault — copy-trade the verified champion on Merchant Moe
/// @notice After a round settles, the protocol routes a slice of incentive capital
///         into a Merchant Moe-compatible LB-router swap (Mantle DeFi) that follows the on-chain
///         verified champion's direction. The arena stays no-capital-at-risk for
///         participants; this vault turns the *winning* prediction into actual
///         Mantle DeFi flow — substantive ecosystem use + a "copy-trade verified
///         alpha" consumer product. The direction is read from the chain (the
///         champion's revealed call), so it can't be spoofed; the keeper only sets
///         size + slippage.
contract ChampionVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    ProofOfAlpha public immutable poa;
    ILBRouter public immutable router;
    IERC20 public immutable baseToken; // e.g. mETH
    IERC20 public immutable quoteToken; // e.g. USDY
    uint256 public immutable binStep; // Merchant Moe LB pair bin step for base/quote

    mapping(address => bool) public isKeeper;
    mapping(uint256 => bool) public traded; // roundId => executed

    event KeeperSet(address indexed keeper, bool allowed);
    event ChampionTradeExecuted(
        uint256 indexed roundId,
        uint256 indexed agentId,
        bool long,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    error NotKeeper(address caller);
    error RoundNotSettled(uint256 roundId);
    error NoChampion(uint256 roundId);
    error AlreadyTraded(uint256 roundId);
    error NoDirection(uint256 roundId);

    modifier onlyKeeper() {
        if (!isKeeper[msg.sender]) revert NotKeeper(msg.sender);
        _;
    }

    constructor(
        address poa_,
        address router_,
        address base_,
        address quote_,
        uint256 binStep_,
        address owner_
    ) Ownable(owner_) {
        poa = ProofOfAlpha(poa_);
        router = ILBRouter(router_);
        baseToken = IERC20(base_);
        quoteToken = IERC20(quote_);
        binStep = binStep_;
        isKeeper[owner_] = true;
        emit KeeperSet(owner_, true);
    }

    function setKeeper(address keeper, bool allowed) external onlyOwner {
        isKeeper[keeper] = allowed;
        emit KeeperSet(keeper, allowed);
    }

    /// @notice Copy-trade the verified champion of a settled round on Merchant Moe.
    ///         long champion (predictedBps > 0) => buy base with quote; short => sell base.
    /// @param amountIn       size of incentive capital to deploy (in the tokenIn).
    /// @param amountOutMin   slippage floor (keeper computes off-chain via LBQuoter).
    function executeChampionTrade(uint256 roundId, uint256 amountIn, uint256 amountOutMin, uint256 deadline)
        external
        onlyKeeper
        nonReentrant
        returns (uint256 amountOut)
    {
        ProofOfAlpha.Round memory r = poa.getRound(roundId);
        if (!r.settled) revert RoundNotSettled(roundId);
        if (!r.hasWinner) revert NoChampion(roundId);
        if (traded[roundId]) revert AlreadyTraded(roundId);

        ProofOfAlpha.Entry memory e = poa.getEntry(roundId, r.topAgentId);
        if (e.predictedBps == 0) revert NoDirection(roundId);
        bool long = e.predictedBps > 0; // bullish on base -> buy base

        IERC20 tokenIn = long ? quoteToken : baseToken;
        IERC20 tokenOut = long ? baseToken : quoteToken;

        traded[roundId] = true; // effects before interaction
        tokenIn.forceApprove(address(router), amountIn);

        ILBRouter.Path memory path;
        path.pairBinSteps = new uint256[](1);
        path.pairBinSteps[0] = binStep;
        path.versions = new LBVersion[](1);
        path.versions[0] = LBVersion.V2_2;
        path.tokenPath = new IERC20[](2);
        path.tokenPath[0] = tokenIn;
        path.tokenPath[1] = tokenOut;

        amountOut = router.swapExactTokensForTokens(amountIn, amountOutMin, path, address(this), deadline);

        emit ChampionTradeExecuted(
            roundId, r.topAgentId, long, address(tokenIn), address(tokenOut), amountIn, amountOut
        );
    }

    /// @notice The live "champion portfolio" the vault has accumulated.
    function holdings() external view returns (uint256 base, uint256 quote) {
        return (baseToken.balanceOf(address(this)), quoteToken.balanceOf(address(this)));
    }

    /// @notice Owner manages the incentive capital.
    function withdraw(IERC20 token, address to, uint256 amount) external onlyOwner {
        token.safeTransfer(to, amount);
    }
}
