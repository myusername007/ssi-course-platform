import { expect } from "chai";
import { ethers } from "hardhat";
import type { CourseRegistry, MockIdentityRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("CourseRegistry", function () {
  let mockRegistry: MockIdentityRegistry;
  let courseRegistry: CourseRegistry;
  let verifiedUser: HardhatEthersSigner;
  let unverifiedUser: HardhatEthersSigner;

  const COURSE_A = 1n;
  const COURSE_B = 2n;

  beforeEach(async function () {
    [, verifiedUser, unverifiedUser] = await ethers.getSigners();

    const MockIdentityRegistryFactory = await ethers.getContractFactory("MockIdentityRegistry");
    mockRegistry = await MockIdentityRegistryFactory.deploy();

    const CourseRegistryFactory = await ethers.getContractFactory("CourseRegistry");
    courseRegistry = await CourseRegistryFactory.deploy(await mockRegistry.getAddress());

    // give verifiedUser a non-zero identity timestamp in the mock registry
    await mockRegistry.setVerified(verifiedUser.address, 1_700_000_000);
    // unverifiedUser is left at the mock's default (0 == not registered)
  });

  describe("isVerified", function () {
    it("returns true for an address the identity registry reports as registered", async function () {
      expect(await courseRegistry.isVerified(verifiedUser.address)).to.equal(true);
    });

    it("returns false for an address with no identity record", async function () {
      expect(await courseRegistry.isVerified(unverifiedUser.address)).to.equal(false);
    });
  });

  describe("registerForCourse", function () {
    it("reverts with NotVerified when the caller has no SSI identity", async function () {
      await expect(
        courseRegistry.connect(unverifiedUser).registerForCourse(COURSE_A)
      ).to.be.revertedWithCustomError(courseRegistry, "NotVerified");
    });

    it("registers a verified caller and emits CourseRegistered", async function () {
      const tx = await courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(courseRegistry, "CourseRegistered")
        .withArgs(verifiedUser.address, COURSE_A, block!.timestamp);
    });

    it("records a non-zero registration timestamp readable via getCourseRegistration", async function () {
      expect(await courseRegistry.getCourseRegistration(verifiedUser.address, COURSE_A)).to.equal(0);

      await courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A);

      expect(
        await courseRegistry.getCourseRegistration(verifiedUser.address, COURSE_A)
      ).to.be.greaterThan(0);
    });

    it("reverts with AlreadyRegisteredForCourse on a second registration for the same course", async function () {
      await courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A);

      await expect(
        courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A)
      ).to.be.revertedWithCustomError(courseRegistry, "AlreadyRegisteredForCourse");
    });

    it("allows the same verified user to register for a different courseId independently", async function () {
      await courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A);
      await expect(courseRegistry.connect(verifiedUser).registerForCourse(COURSE_B)).to.not.be.reverted;

      expect(await courseRegistry.getCourseRegistration(verifiedUser.address, COURSE_A)).to.be.greaterThan(0);
      expect(await courseRegistry.getCourseRegistration(verifiedUser.address, COURSE_B)).to.be.greaterThan(0);
    });

    it("stops reflecting a user as verified if the identity registry later reports them as revoked", async function () {
      await courseRegistry.connect(verifiedUser).registerForCourse(COURSE_A);

      // simulate revokeIdentity() on the real BasicIdentityRegistry: timestamp resets to 0
      await mockRegistry.setVerified(verifiedUser.address, 0);

      expect(await courseRegistry.isVerified(verifiedUser.address)).to.equal(false);
      // the already-completed registration for COURSE_A remains on record —
      // revocation does not retroactively erase past course registrations
      expect(await courseRegistry.getCourseRegistration(verifiedUser.address, COURSE_A)).to.be.greaterThan(0);
      // but a NEW registration is now blocked
      await expect(
        courseRegistry.connect(verifiedUser).registerForCourse(COURSE_B)
      ).to.be.revertedWithCustomError(courseRegistry, "NotVerified");
    });
  });

  describe("getCourseRegistration", function () {
    it("returns 0 for a user/course pair that was never registered", async function () {
      expect(await courseRegistry.getCourseRegistration(unverifiedUser.address, COURSE_A)).to.equal(0);
    });
  });
});
