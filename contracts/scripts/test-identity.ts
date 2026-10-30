import { ethers } from "hardhat";
import type { Wallet } from "ethers";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// A throwaway wallet with a consistent identity record in the REAL identity
// registry, used by the live verification scripts as a ticket buyer. (The
// organizer's own address cannot play that role: its demo record is
// deliberately inconsistent.) The key lives in a git-ignored file, holds no
// value and exists only on Sepolia.
export const IDENTITY_REGISTRY = "0xBdd500644fff1693f14f3853DB1fa5fba5BC2558";
const FILE = join(__dirname, "..", ".test-identity.json");

export const identityAbi = [
  "function registerIdentity(string fullname, string cid, bytes32 dataHash)",
  "function getIdentity(address user) view returns (string fullname, string cid, bytes32 dataHash, uint256 timestamp)",
];

export function loadTestIdentity(): Wallet {
  if (!existsSync(FILE)) throw new Error("Run scripts/test-identity.ts first (creates contracts/.test-identity.json)");
  const { privateKey } = JSON.parse(readFileSync(FILE, "utf-8"));
  return new ethers.Wallet(privateKey, ethers.provider);
}

async function main() {
  const [organizer] = await ethers.getSigners();
  let wallet: Wallet;
  if (existsSync(FILE)) {
    wallet = loadTestIdentity();
  } else {
    const w = ethers.Wallet.createRandom();
    writeFileSync(FILE, JSON.stringify({ address: w.address, privateKey: w.privateKey }, null, 2) + "\n", { mode: 0o600 });
    wallet = new ethers.Wallet(w.privateKey, ethers.provider);
  }
  console.log(`Test identity wallet: ${wallet.address}`);

  const balance = await ethers.provider.getBalance(wallet.address);
  if (balance < ethers.parseEther("0.01")) {
    await (await organizer.sendTransaction({ to: wallet.address, value: ethers.parseEther("0.02") })).wait();
    console.log("Funded with 0.02 ETH");
  }

  const registry = new ethers.Contract(IDENTITY_REGISTRY, identityAbi, wallet);
  const existing = await registry.getIdentity(wallet.address);
  if (existing.timestamp !== 0n) {
    console.log(`Already registered (timestamp ${existing.timestamp}).`);
    return;
  }
  const cid = "bafytestidentity" + wallet.address.slice(2, 14).toLowerCase();
  const dataHash = ethers.keccak256(ethers.toUtf8Bytes("ipfs/" + cid)); // the SSI dApp's convention
  const receipt = await (await registry.registerIdentity("Test Identity", cid, dataHash)).wait();
  console.log(`Registered in the identity registry (gas ${receipt!.gasUsed}), cid ${cid}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
