import { ethers, network } from "hardhat";

// Address of the existing, already-deployed BasicIdentityRegistry from the
// bachelor's thesis SSI dApp (Sepolia). CourseRegistry only ever reads from
// it (getIdentity, via IIdentityRegistry) — never written to, never
// redeployed.
const IDENTITY_REGISTRY_ADDRESS = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

async function main() {
  if (network.name === "sepolia" && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error(
      "DEPLOYER_PRIVATE_KEY is not set. Add it to contracts/.env before deploying to Sepolia."
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deploying CourseRegistry with account: ${deployer.address}`);
  console.log(`Network: ${network.name}`);
  console.log(`IIdentityRegistry target: ${IDENTITY_REGISTRY_ADDRESS}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer balance: ${ethers.formatEther(balance)} ETH`);

  const CourseRegistry = await ethers.getContractFactory("CourseRegistry");
  const courseRegistry = await CourseRegistry.deploy(IDENTITY_REGISTRY_ADDRESS);
  await courseRegistry.waitForDeployment();

  const address = await courseRegistry.getAddress();
  console.log(`\nCourseRegistry deployed to: ${address}`);
  console.log(
    `\nNext steps:\n` +
      `  1. Save this address — it's needed in the frontend (Stage 5).\n` +
      `  2. If on Sepolia and ETHERSCAN_API_KEY is set, verify with:\n` +
      `     npx hardhat verify --network sepolia ${address} ${IDENTITY_REGISTRY_ADDRESS}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
