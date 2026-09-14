import { ethers } from "hardhat";

// One-off verification against REAL contracts on Sepolia — not a unit test
// against a mock. Confirms CourseRegistry's isVerified() actually agrees
// with the real BasicIdentityRegistry for real addresses, and correctly
// rejects an address that has never registered.
const COURSE_REGISTRY = "0x3fD6670b1e25A0D35968ba0eB06A08856a16b11B";
const IDENTITY_REGISTRY = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

// Addresses observed with real IdentityRegistered/IdentityUpdated activity
// on the old SSI dApp's contract earlier in this session's transaction
// history review.
const CANDIDATE_ADDRESSES = [
  "0x587683209985D130BCD9B4c81a3b7f5a37850B48", // deployer wallet used for this session's testing
  "0x709eAAb95D3AE0cC37964cc76809b23f23f992Db", // original BasicIdentityRegistry deployer, seen registering identities
  "0xDe01d61591c60c882836277e2bC6D95423b67e6e", // seen with IdentityRegistered/Revoked activity
  "0x01b67aC209a773a52FF5F34C71fd6A0f4438C9aa", // seen with repeated register/revoke activity
];
const DEFINITELY_UNREGISTERED = "0x000000000000000000000000000000000000dEaD"; // burn address

const identityAbi = [
  "function getIdentity(address user) external view returns (string memory fullname, string memory cid, bytes32 dataHash, uint256 timestamp)",
];
const courseRegistryAbi = [
  "function isVerified(address user) public view returns (bool)",
  "function identityRegistry() public view returns (address)",
];

async function main() {
  const identity = new ethers.Contract(IDENTITY_REGISTRY, identityAbi, ethers.provider);
  const courseRegistry = new ethers.Contract(COURSE_REGISTRY, courseRegistryAbi, ethers.provider);

  const configuredIdentityRegistry = await courseRegistry.identityRegistry();
  console.log(`CourseRegistry.identityRegistry() = ${configuredIdentityRegistry}`);
  console.log(
    `Matches expected BasicIdentityRegistry: ${
      configuredIdentityRegistry.toLowerCase() === IDENTITY_REGISTRY.toLowerCase()
    }`
  );
  console.log("");

  for (const addr of CANDIDATE_ADDRESSES) {
    const [fullname, , , timestamp] = await identity.getIdentity(addr);
    const directlyVerified = timestamp !== 0n;
    const viaCourseRegistry = await courseRegistry.isVerified(addr);
    const agree = directlyVerified === viaCourseRegistry;

    console.log(`${addr}`);
    console.log(`  BasicIdentityRegistry.getIdentity: fullname="${fullname}", timestamp=${timestamp}`);
    console.log(`  => directly verified: ${directlyVerified}`);
    console.log(`  CourseRegistry.isVerified():        ${viaCourseRegistry}`);
    console.log(`  AGREE: ${agree ? "YES" : "NO <<<<<<<<<< MISMATCH"}`);
    console.log("");
  }

  const unregisteredResult = await courseRegistry.isVerified(DEFINITELY_UNREGISTERED);
  console.log(`Burn address (never registered) isVerified(): ${unregisteredResult}`);
  console.log(`Expected: false — ${unregisteredResult === false ? "CORRECT" : "WRONG <<<<<<<<<<"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
