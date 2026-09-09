// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/IIdentityRegistry.sol";

/// @notice Test-only stand-in for the real BasicIdentityRegistry. Lets
/// CourseRegistry's tests control exactly which addresses are "verified"
/// (non-zero timestamp) without needing a forked Sepolia network or the
/// real, unverified contract's bytecode.
contract MockIdentityRegistry is IIdentityRegistry {
    mapping(address => uint256) private _timestamps;

    /// @notice Test helper — sets (or clears, with 0) the identity
    /// timestamp for `user`.
    function setVerified(address user, uint256 timestamp) external {
        _timestamps[user] = timestamp;
    }

    function getIdentity(address user)
        external
        view
        override
        returns (
            string memory fullname,
            string memory cid,
            bytes32 dataHash,
            uint256 timestamp
        )
    {
        return ("", "", bytes32(0), _timestamps[user]);
    }
}
