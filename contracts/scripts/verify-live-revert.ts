import { ethers } from "hardhat";

const COURSE_REGISTRY = "0x3fD6670b1e25A0D35968ba0eB06A08856a16b11B";
const abi = ["function registerForCourse(uint256 courseId) external"];

async function main() {
  // random wallet, no funds needed for a static (simulated, non-broadcast) call
  const randomWallet = ethers.Wallet.createRandom().connect(ethers.provider);
  const contract = new ethers.Contract(COURSE_REGISTRY, abi, randomWallet);

  console.log(`Simulating registerForCourse() from unverified address: ${randomWallet.address}`);
  try {
    await contract.registerForCourse.staticCall(1);
    console.log("FAILED: call did not revert");
    process.exitCode = 1;
  } catch (err: any) {
    const reverted = /NotVerified/.test(err.message) || /revert/i.test(err.message);
    console.log(`Reverted as expected: ${reverted}`);
    console.log(`Error detail: ${err.shortMessage || err.message}`);
  }
}

main();
