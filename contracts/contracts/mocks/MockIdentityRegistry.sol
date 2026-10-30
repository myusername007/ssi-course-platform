// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "../interfaces/IIdentityRegistry.sol";

/// @notice Test-only stand-in for the real BasicIdentityRegistry. Lets
/// the contracts' tests control exactly which addresses hold a record
/// (non-zero timestamp, consistent or not) without needing a forked Sepolia network or the
/// real, unverified contract's bytecode.
contract MockIdentityRegistry is IIdentityRegistry {
    struct Record {
        string cid;
        bytes32 dataHash;
        uint256 timestamp;
    }

    mapping(address => Record) private _records;

    /// @notice Test helper — sets (or clears, with 0) the identity
    /// timestamp for `user`. A non-zero timestamp comes with a CONSISTENT
    /// record, built the way the SSI dApp builds it
    /// (dataHash = keccak256("ipfs/" ++ cid)); zero clears the record.
    function setVerified(address user, uint256 timestamp) external {
        if (timestamp == 0) {
            delete _records[user];
            return;
        }
        string memory cid = "bafytestcid";
        _records[user] = Record(cid, keccak256(abi.encodePacked("ipfs/", cid)), timestamp);
    }

    /// @notice Test helper — stores an arbitrary record, including one whose
    /// hash does not match its CID.
    function setIdentity(address user, string calldata cid, bytes32 dataHash, uint256 timestamp) external {
        _records[user] = Record(cid, dataHash, timestamp);
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
        Record storage r = _records[user];
        return ("", r.cid, r.dataHash, r.timestamp);
    }
}
