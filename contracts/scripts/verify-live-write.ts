import { ethers } from "hardhat";

// Full end-to-end live test: an actual registerForCourse() transaction on
// Sepolia, using the deployer wallet (confirmed verified in the real
// BasicIdentityRegistry by scripts/verify-live.ts). Costs a small amount of
// Sepolia ETH gas — no real monetary value. This is the strongest possible
// confirmation short of a real user going through the actual UI.
const COURSE_REGISTRY = "0x3fD6670b1e25A0D35968ba0eB06A08856a16b11B";
const TEST_COURSE_ID = 999999; // deliberately outside the seeded demo course IDs

const abi = [
  "function registerForCourse(uint256 courseId) external",
  "function getCourseRegistration(address user, uint256 courseId) external view returns (uint256)",
  "event CourseRegistered(address indexed user, uint256 indexed courseId, uint256 timestamp)",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const contract = new ethers.Contract(COURSE_REGISTRY, abi, signer);

  console.log(`Signer: ${signer.address}`);

  const before = await contract.getCourseRegistration(signer.address, TEST_COURSE_ID);
  console.log(`getCourseRegistration before: ${before}`);

  if (before !== 0n) {
    console.log("Already registered for this test courseId from a previous run — skipping tx, reading state only.");
    return;
  }

  console.log(`\nSending registerForCourse(${TEST_COURSE_ID})...`);
  const tx = await contract.registerForCourse(TEST_COURSE_ID);
  console.log(`Tx hash: ${tx.hash}`);
  console.log("Waiting for confirmation...");
  const receipt = await tx.wait();
  console.log(`Confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed}`);

  const parsedEvents = receipt.logs
    .map((log: any) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const registeredEvent = parsedEvents.find((e: any) => e.name === "CourseRegistered");
  console.log(
    `\nCourseRegistered event: user=${registeredEvent.args.user}, courseId=${registeredEvent.args.courseId}, timestamp=${registeredEvent.args.timestamp}`
  );

  const after = await contract.getCourseRegistration(signer.address, TEST_COURSE_ID);
  console.log(`getCourseRegistration after: ${after}`);
  console.log(`\nEnd-to-end result: ${after !== 0n ? "SUCCESS" : "FAILED <<<<<<<<<<"}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
