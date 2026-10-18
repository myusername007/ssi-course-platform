import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import type { TicketRegistry, MockIdentityRegistry } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TicketRegistry", function () {
  let mockRegistry: MockIdentityRegistry;
  let tickets: TicketRegistry;
  let organizer: HardhatEthersSigner;
  let alice: HardhatEthersSigner; // verified
  let bob: HardhatEthersSigner; // verified
  let carol: HardhatEthersSigner; // NOT verified

  const EVENT = 1n;
  const PRICE = ethers.parseEther("0.0008");

  let startsAt: number;
  let endsAt: number;

  async function createDefaultEvent(capacity = 10) {
    await tickets.createEvent(EVENT, PRICE, capacity, startsAt, endsAt);
  }

  beforeEach(async function () {
    [organizer, alice, bob, carol] = await ethers.getSigners();

    const Mock = await ethers.getContractFactory("MockIdentityRegistry");
    mockRegistry = await Mock.deploy();
    const Tickets = await ethers.getContractFactory("TicketRegistry");
    tickets = await Tickets.deploy(await mockRegistry.getAddress());

    await mockRegistry.setVerified(alice.address, 1_700_000_000);
    await mockRegistry.setVerified(bob.address, 1_700_000_000);

    const now = await time.latest();
    startsAt = now + 3600;
    endsAt = now + 7200;
  });

  describe("isVerified", function () {
    it("reflects the identity registry", async function () {
      expect(await tickets.isVerified(alice.address)).to.equal(true);
      expect(await tickets.isVerified(carol.address)).to.equal(false);
    });
  });

  describe("createEvent", function () {
    it("creates an event and emits EventCreated", async function () {
      await expect(tickets.createEvent(EVENT, PRICE, 10, startsAt, endsAt))
        .to.emit(tickets, "EventCreated")
        .withArgs(EVENT, PRICE, 10, startsAt, endsAt);

      const e = await tickets.eventInfo(EVENT);
      expect(e.price).to.equal(PRICE);
      expect(e.capacity).to.equal(10);
      expect(e.sold).to.equal(0);
      expect(e.exists).to.equal(true);
    });

    it("is restricted to the organizer", async function () {
      await expect(
        tickets.connect(alice).createEvent(EVENT, PRICE, 10, startsAt, endsAt)
      ).to.be.revertedWithCustomError(tickets, "NotOwner");
    });

    it("rejects a duplicate id", async function () {
      await createDefaultEvent();
      await expect(
        tickets.createEvent(EVENT, PRICE, 10, startsAt, endsAt)
      ).to.be.revertedWithCustomError(tickets, "EventAlreadyExists");
    });

    it("rejects zero capacity, a past start, or end before start", async function () {
      await expect(tickets.createEvent(EVENT, PRICE, 0, startsAt, endsAt))
        .to.be.revertedWithCustomError(tickets, "InvalidEventParams");
      await expect(tickets.createEvent(EVENT, PRICE, 10, (await time.latest()) - 1, endsAt))
        .to.be.revertedWithCustomError(tickets, "InvalidEventParams");
      await expect(tickets.createEvent(EVENT, PRICE, 10, startsAt, startsAt))
        .to.be.revertedWithCustomError(tickets, "InvalidEventParams");
    });
  });

  describe("buyTicket", function () {
    beforeEach(async function () {
      await createDefaultEvent();
    });

    it("sells a ticket to a verified buyer and emits TicketPurchased", async function () {
      await expect(tickets.connect(alice).buyTicket(EVENT, { value: PRICE }))
        .to.emit(tickets, "TicketPurchased")
        .withArgs(1, EVENT, alice.address, PRICE);

      const t = await tickets.ticketInfo(1);
      expect(t.ticketOwner).to.equal(alice.address);
      expect(t.eventId).to.equal(EVENT);
      expect(t.used).to.equal(false);
      expect(await tickets.ticketOf(alice.address, EVENT)).to.equal(1);
      expect((await tickets.eventInfo(EVENT)).sold).to.equal(1);
      expect(await tickets.totalTickets()).to.equal(1);
    });

    it("assigns unique sequential ticket ids", async function () {
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
      await tickets.connect(bob).buyTicket(EVENT, { value: PRICE });
      expect(await tickets.ticketOf(alice.address, EVENT)).to.equal(1);
      expect(await tickets.ticketOf(bob.address, EVENT)).to.equal(2);
    });

    it("reverts NotVerified for a wallet without an identity", async function () {
      await expect(
        tickets.connect(carol).buyTicket(EVENT, { value: PRICE })
      ).to.be.revertedWithCustomError(tickets, "NotVerified");
    });

    it("allows only one ticket per identity per event", async function () {
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
      await expect(
        tickets.connect(alice).buyTicket(EVENT, { value: PRICE })
      ).to.be.revertedWithCustomError(tickets, "AlreadyHasTicket");
    });

    it("allows the same identity to buy for a different event", async function () {
      await tickets.createEvent(2n, PRICE, 5, startsAt, endsAt);
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
      await tickets.connect(alice).buyTicket(2n, { value: PRICE });
      expect(await tickets.ticketOf(alice.address, 2n)).to.equal(2);
    });

    it("requires the exact price", async function () {
      await expect(tickets.connect(alice).buyTicket(EVENT, { value: PRICE - 1n }))
        .to.be.revertedWithCustomError(tickets, "WrongPayment");
      await expect(tickets.connect(alice).buyTicket(EVENT, { value: PRICE + 1n }))
        .to.be.revertedWithCustomError(tickets, "WrongPayment");
      await expect(tickets.connect(alice).buyTicket(EVENT))
        .to.be.revertedWithCustomError(tickets, "WrongPayment");
    });

    it("reverts for an unknown event", async function () {
      await expect(tickets.connect(alice).buyTicket(99n, { value: PRICE }))
        .to.be.revertedWithCustomError(tickets, "EventNotFound");
    });

    it("sells out exactly at capacity", async function () {
      await tickets.createEvent(2n, PRICE, 1, startsAt, endsAt);
      await tickets.connect(alice).buyTicket(2n, { value: PRICE });
      await expect(tickets.connect(bob).buyTicket(2n, { value: PRICE }))
        .to.be.revertedWithCustomError(tickets, "SoldOut");
    });

    it("closes the sale when the event starts", async function () {
      await time.increaseTo(startsAt);
      await expect(tickets.connect(alice).buyTicket(EVENT, { value: PRICE }))
        .to.be.revertedWithCustomError(tickets, "SaleClosed");
    });

    it("does not accept plain ETH transfers", async function () {
      await expect(
        alice.sendTransaction({ to: await tickets.getAddress(), value: 1n })
      ).to.be.reverted;
    });
  });

  describe("markUsed", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
    });

    it("marks a ticket used and emits TicketUsed", async function () {
      await expect(tickets.markUsed(1)).to.emit(tickets, "TicketUsed").withArgs(1, EVENT);
      expect((await tickets.ticketInfo(1)).used).to.equal(true);
    });

    it("is restricted to the organizer", async function () {
      await expect(tickets.connect(alice).markUsed(1))
        .to.be.revertedWithCustomError(tickets, "NotOwner");
    });

    it("cannot be applied twice", async function () {
      await tickets.markUsed(1);
      await expect(tickets.markUsed(1)).to.be.revertedWithCustomError(tickets, "AlreadyUsed");
    });

    it("reverts for a ticket that does not exist", async function () {
      await expect(tickets.markUsed(42)).to.be.revertedWithCustomError(tickets, "TicketNotFound");
      await expect(tickets.ticketInfo(42)).to.be.revertedWithCustomError(tickets, "TicketNotFound");
    });
  });

  describe("rateEvent", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
      await tickets.connect(bob).buyTicket(EVENT, { value: PRICE });
    });

    it("is not allowed before the event ends", async function () {
      await tickets.markUsed(1);
      await expect(tickets.connect(alice).rateEvent(EVENT, 5))
        .to.be.revertedWithCustomError(tickets, "EventNotFinished");
    });

    it("is not allowed without a ticket", async function () {
      await time.increaseTo(endsAt);
      await expect(tickets.connect(carol).rateEvent(EVENT, 5))
        .to.be.revertedWithCustomError(tickets, "NoTicket");
    });

    it("is not allowed if the ticket was never used (did not attend)", async function () {
      await time.increaseTo(endsAt);
      await expect(tickets.connect(alice).rateEvent(EVENT, 5))
        .to.be.revertedWithCustomError(tickets, "NotAttended");
    });

    it("rejects scores outside 1..5", async function () {
      await tickets.markUsed(1);
      await time.increaseTo(endsAt);
      await expect(tickets.connect(alice).rateEvent(EVENT, 0))
        .to.be.revertedWithCustomError(tickets, "InvalidScore");
      await expect(tickets.connect(alice).rateEvent(EVENT, 6))
        .to.be.revertedWithCustomError(tickets, "InvalidScore");
    });

    it("records a rating, emits EventRated and aggregates", async function () {
      await tickets.markUsed(1);
      await tickets.markUsed(2);
      await time.increaseTo(endsAt);

      await expect(tickets.connect(alice).rateEvent(EVENT, 5))
        .to.emit(tickets, "EventRated")
        .withArgs(EVENT, alice.address, 5);
      await tickets.connect(bob).rateEvent(EVENT, 3);

      const r = await tickets.getRating(EVENT);
      expect(r.sum).to.equal(8);
      expect(r.count).to.equal(2);
      expect(await tickets.ratingOf(EVENT, alice.address)).to.equal(5);
    });

    it("allows only one rating per holder", async function () {
      await tickets.markUsed(1);
      await time.increaseTo(endsAt);
      await tickets.connect(alice).rateEvent(EVENT, 4);
      await expect(tickets.connect(alice).rateEvent(EVENT, 5))
        .to.be.revertedWithCustomError(tickets, "AlreadyRated");
    });

    it("reverts for an unknown event", async function () {
      await expect(tickets.connect(alice).rateEvent(99n, 5))
        .to.be.revertedWithCustomError(tickets, "EventNotFound");
    });
  });

  describe("withdraw", function () {
    it("sends collected payments to the organizer only", async function () {
      await createDefaultEvent();
      await tickets.connect(alice).buyTicket(EVENT, { value: PRICE });
      await tickets.connect(bob).buyTicket(EVENT, { value: PRICE });

      const addr = await tickets.getAddress();
      expect(await ethers.provider.getBalance(addr)).to.equal(PRICE * 2n);

      await expect(tickets.connect(alice).withdraw())
        .to.be.revertedWithCustomError(tickets, "NotOwner");

      await expect(tickets.withdraw())
        .to.emit(tickets, "Withdrawn")
        .withArgs(organizer.address, PRICE * 2n);
      expect(await ethers.provider.getBalance(addr)).to.equal(0);
    });
  });
});
