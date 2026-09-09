// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "./interfaces/IIdentityRegistry.sol";

/// @notice Records course registrations for wallets that already hold a
/// verified identity in the existing BasicIdentityRegistry (bachelor's
/// thesis SSI dApp, Sepolia 0xBdd500644fff1693f14f3853DB1fa5fba5BC2558).
/// This contract never writes to that registry — it only ever calls its
/// read-only getIdentity() through the IIdentityRegistry interface.
contract CourseRegistry {
    IIdentityRegistry public immutable identityRegistry;

    /// user => courseId => timestamp of registration (0 = not registered)
    mapping(address => mapping(uint256 => uint256)) private _registrations;

    /// @notice Emitted when a verified user registers for a course
    event CourseRegistered(address indexed user, uint256 indexed courseId, uint256 timestamp);

    /// @notice user has no verified identity in BasicIdentityRegistry
    error NotVerified();
    /// @notice user already registered for this courseId
    error AlreadyRegisteredForCourse();

    constructor(address identityRegistryAddress) {
        identityRegistry = IIdentityRegistry(identityRegistryAddress);
    }

    /// @notice Returns true if `user` has a registered identity (non-zero
    /// timestamp) in BasicIdentityRegistry.
    function isVerified(address user) public view returns (bool) {
        (, , , uint256 timestamp) = identityRegistry.getIdentity(user);
        return timestamp != 0;
    }

    /// @notice Registers the caller for `courseId`. Reverts if the caller's
    /// SSI identity is not verified, or if they are already registered for
    /// this course.
    function registerForCourse(uint256 courseId) external {
        if (!isVerified(msg.sender)) revert NotVerified();
        if (_registrations[msg.sender][courseId] != 0) revert AlreadyRegisteredForCourse();

        _registrations[msg.sender][courseId] = block.timestamp;
        emit CourseRegistered(msg.sender, courseId, block.timestamp);
    }

    /// @notice Returns the registration timestamp for `user`/`courseId`,
    /// or 0 if they are not registered.
    function getCourseRegistration(address user, uint256 courseId) external view returns (uint256) {
        return _registrations[user][courseId];
    }
}
