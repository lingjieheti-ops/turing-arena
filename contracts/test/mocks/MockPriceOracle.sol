// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPriceOracle } from "../../src/oracle/IPriceOracle.sol";

/// @dev Freely-settable oracle for tests + local demos.
contract MockPriceOracle is IPriceOracle {
    uint8 public constant override decimals = 8;

    mapping(bytes32 => uint256) public price;
    mapping(bytes32 => uint256) public updatedAtOf;

    function setPrice(bytes32 asset, uint256 p) external {
        price[asset] = p;
        updatedAtOf[asset] = block.timestamp;
    }

    function getPrice(bytes32 asset) external view override returns (uint256, uint256) {
        return (price[asset], updatedAtOf[asset]);
    }
}
