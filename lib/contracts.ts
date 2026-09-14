// Frontend-side contract constants. Deployed once (contracts/scripts/deploy.ts,
// see DESCRIPTION.md Stage 5а), never redeployed — this address is fixed.
export const COURSE_REGISTRY_ADDRESS = "0x3fD6670b1e25A0D35968ba0eB06A08856a16b11B";
export const IDENTITY_REGISTRY_ADDRESS = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

export const COURSE_REGISTRY_ABI = [
  "function isVerified(address user) public view returns (bool)",
  "function registerForCourse(uint256 courseId) external",
  "function getCourseRegistration(address user, uint256 courseId) external view returns (uint256)",
  "event CourseRegistered(address indexed user, uint256 indexed courseId, uint256 timestamp)",
];
