import { expect } from "chai";
import { ethers } from "hardhat";

// Sanity check for the Hardhat toolchain itself (network, signers, ethers
// plugin wiring) — not testing any project contract yet. CourseRegistry.sol
// and its own tests come in PLAN.md item 2.
describe("Hardhat toolchain smoke test", function () {
  it("provides local signers with funded balances", async function () {
    const [signer] = await ethers.getSigners();
    expect(signer.address).to.match(/^0x[0-9a-fA-F]{40}$/);

    const balance = await ethers.provider.getBalance(signer.address);
    expect(balance).to.be.greaterThan(0n);
  });
});
