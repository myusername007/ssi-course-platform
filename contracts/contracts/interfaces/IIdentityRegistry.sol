// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @notice Read-only interface to the already-deployed BasicIdentityRegistry
/// (Sepolia: 0xBdd500644fff1693f14f3853DB1fa5fba5BC2558, from the bachelor's
/// thesis SSI Identity dApp). CourseRegistry only ever calls this function —
/// it never writes to the identity registry, and does not need the full
/// contract source, only this exact ABI-matching signature.
interface IIdentityRegistry {
    function getIdentity(address user)
        external
        view
        returns (
            string memory fullname,
            string memory cid,
            bytes32 dataHash,
            uint256 timestamp
        );
}
