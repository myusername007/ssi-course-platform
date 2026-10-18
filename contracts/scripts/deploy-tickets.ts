import { ethers, network } from "hardhat";

// The existing, already-deployed identity registry (Sepolia). TicketRegistry
// only reads from it; it is never written to or redeployed.
const IDENTITY_REGISTRY_ADDRESS = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";

async function main() {
  if (network.name === "sepolia" && !process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY is not set in contracts/.env");
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer (becomes the organizer): ${deployer.address}`);
  console.log(`Network: ${network.name}`);
  console.log(`Identity registry: ${IDENTITY_REGISTRY_ADDRESS}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Balance: ${ethers.formatEther(balance)} ETH`);

  const Factory = await ethers.getContractFactory("TicketRegistry");
  const tickets = await Factory.deploy(IDENTITY_REGISTRY_ADDRESS);
  const deployTx = tickets.deploymentTransaction();
  await tickets.waitForDeployment();

  const receipt = await deployTx!.wait();
  console.log(`\nTicketRegistry deployed to: ${await tickets.getAddress()}`);
  console.log(`Deployment tx: ${deployTx!.hash}`);
  console.log(`Deployment gas used: ${receipt!.gasUsed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
