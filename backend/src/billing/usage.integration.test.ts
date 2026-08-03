import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { Subscription } from "../models/Subscription";
import { UsagePeriod } from "../models/UsagePeriod";
import { UsageLedger } from "../models/UsageLedger";
import { initializeFreeEntitlements } from "./entitlements";
import { reserveUsage, commitUsage, releaseUsage } from "./usage";
import {
  canRunMeteredBackgroundWork,
  tryBackgroundBillingOperation,
  backgroundIdempotencyKey,
} from "./backgroundEnforcement";

dotenv.config();

const TEST_URI = process.env.MONGODB_TEST_URI ?? process.env.MONGODB_URI ?? "";
const canRun = Boolean(TEST_URI);

let mongoReady = false;
const createdUserIds: mongoose.Types.ObjectId[] = [];

async function createSeekerTestUser(): Promise<string> {
  if (!mongoReady) {
    process.env.MONGODB_URI = TEST_URI;
    await connectMongo();
    mongoReady = true;
  }
  const user = await User.create({
    email: `billing-test-${Date.now()}-${Math.random()}@example.com`,
    passwordHash: "test",
    username: `bill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    isVerified: true,
  });
  createdUserIds.push(user._id);
  await initializeFreeEntitlements(user._id.toString());
  await Subscription.updateOne(
    { userId: user._id, category: "seeker" },
    { $set: { plan: "free", status: "free" } },
  ).exec();
  return user._id.toString();
}

async function cleanupUsers(ids: mongoose.Types.ObjectId[]): Promise<void> {
  await Promise.all(
    ids.map(async (oid) => {
      await UsageLedger.deleteMany({ userId: oid });
      await UsagePeriod.deleteMany({ userId: oid });
      await Subscription.deleteMany({ userId: oid });
      await User.deleteOne({ _id: oid });
    }),
  );
}

describe("billing usage reservations (integration)", { skip: !canRun }, () => {
  afterEach(async () => {
    if (createdUserIds.length === 0) return;
    const batch = createdUserIds.splice(0, createdUserIds.length);
    await cleanupUsers(batch);
  });

  it("allows reservations up to the exact free AI unit limit", async () => {
    const userId = await createSeekerTestUser();
    for (let i = 0; i < 10; i += 1) {
      const reservation = await reserveUsage({
        userId,
        category: "seeker",
        operation: "email_intelligence",
        idempotencyKey: `limit-boundary-${userId}-${i}`,
      });
      await commitUsage(reservation.reservationId);
    }
  });

  it("blocks one request beyond the free AI unit limit", async () => {
    const userId = await createSeekerTestUser();
    for (let i = 0; i < 10; i += 1) {
      const reservation = await reserveUsage({
        userId,
        category: "seeker",
        operation: "email_intelligence",
        idempotencyKey: `prefill-${userId}-${i}`,
      });
      await commitUsage(reservation.reservationId);
    }
    await assert.rejects(
      () =>
        reserveUsage({
          userId,
          category: "seeker",
          operation: "email_intelligence",
          idempotencyKey: `overflow-${userId}`,
        }),
      (error: any) => error.code === "PLAN_LIMIT_REACHED",
    );
  });

  it("returns the same reservation for duplicate idempotency keys", async () => {
    const userId = await createSeekerTestUser();
    const key = `idem-${userId}-cover-letter`;
    const first = await reserveUsage({
      userId,
      category: "seeker",
      operation: "cover_letter",
      idempotencyKey: key,
    });
    const second = await reserveUsage({
      userId,
      category: "seeker",
      operation: "cover_letter",
      idempotencyKey: key,
    });
    assert.equal(first.reservationId, second.reservationId);
    await releaseUsage(first.reservationId);
  });

  it("makes commit and release transitions idempotent", async () => {
    const userId = await createSeekerTestUser();
    const reservation = await reserveUsage({
      userId,
      category: "seeker",
      operation: "email_intelligence",
      idempotencyKey: `commit-idempotent-${userId}`,
    });
    const firstCommit = await commitUsage(reservation.reservationId);
    const secondCommit = await commitUsage(reservation.reservationId);
    assert.equal(firstCommit.status, "committed");
    assert.equal(secondCommit.status, "committed");
    assert.equal(firstCommit.reservationId, secondCommit.reservationId);

    const releaseReservation = await reserveUsage({
      userId,
      category: "seeker",
      operation: "email_intelligence",
      idempotencyKey: `release-idempotent-${userId}`,
    });
    const firstRelease = await releaseUsage(releaseReservation.reservationId);
    const secondRelease = await releaseUsage(releaseReservation.reservationId);
    assert.equal(firstRelease.status, "released");
    assert.equal(secondRelease.status, "released");
  });

  it("prevents concurrent reservations from exceeding the limit", async () => {
    const userId = await createSeekerTestUser();
    const attempts = Array.from({ length: 12 }, (_, index) =>
      reserveUsage({
        userId,
        category: "seeker",
        operation: "resume_improve",
        idempotencyKey: `concurrent-${userId}-${index}`,
      }).then(
        (reservation) => ({ ok: true as const, reservation }),
        (error) => ({ ok: false as const, error }),
      ),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    assert.equal(succeeded.length, 10);
    assert.equal(failed.length, 2);
    for (const result of succeeded) {
      if (result.ok) await releaseUsage(result.reservation.reservationId);
    }
  });

  it("prevents concurrent Form Job intake from exceeding Free form_responses (25)", async () => {
    const userId = await createSeekerTestUser();
    await Subscription.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), category: "creator_form" },
      { $set: { plan: "free", status: "free" } },
    ).exec();

    const attempts = Array.from({ length: 30 }, (_, index) =>
      reserveUsage({
        userId,
        category: "creator_form",
        operation: "form_response_intake",
        idempotencyKey: `form-intake-concurrent-${userId}-${index}`,
      }).then(
        (reservation) => ({ ok: true as const, reservation }),
        (error) => ({ ok: false as const, error }),
      ),
    );
    const results = await Promise.all(attempts);
    const succeeded = results.filter((result) => result.ok);
    const failed = results.filter((result) => !result.ok);
    assert.equal(succeeded.length, 25);
    assert.equal(failed.length, 5);
    for (const result of failed) {
      if (!result.ok) {
        assert.equal((result.error as any).code, "PLAN_LIMIT_REACHED");
        assert.equal((result.error as any).feature, "form_responses");
      }
    }
    for (const result of succeeded) {
      if (result.ok) await commitUsage(result.reservation.reservationId);
    }

    await assert.rejects(
      () =>
        reserveUsage({
          userId,
          category: "creator_form",
          operation: "form_response_intake",
          idempotencyKey: `form-intake-overflow-${userId}`,
        }),
      (error: any) =>
        error.code === "PLAN_LIMIT_REACHED" && error.feature === "form_responses",
    );
  });

  it("blocks background metered work when creator_standard is past_due (Phase 4 cron gate)", async () => {
    const userId = await createSeekerTestUser();
    await Subscription.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), category: "creator_standard" },
      {
        $set: {
          plan: "pro",
          status: "past_due",
          provider: "razorpay",
          currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
          currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
          cancelAtPeriodEnd: false,
        },
      },
    ).exec();

    const gate = await canRunMeteredBackgroundWork(userId, "creator_standard");
    assert.equal(gate.allowed, false);
    assert.equal(gate.reason, "billing_access_restricted");

    const outcome = await tryBackgroundBillingOperation({
      ownerUid: userId,
      category: "creator_standard",
      operation: "daily_briefing",
      idempotencyKey: backgroundIdempotencyKey(userId, ["daily-briefing", "phase4-test"]),
      work: async () => {
        throw new Error("background work must not run when billing is restricted");
      },
    });
    assert.equal(outcome.ok, false);
  });

  it("reuses the same reservation for duplicate background idempotency keys (no double charge)", async () => {
    const userId = await createSeekerTestUser();
    await Subscription.updateOne(
      { userId: new mongoose.Types.ObjectId(userId), category: "creator_standard" },
      { $set: { plan: "free", status: "free" } },
    ).exec();

    const key = backgroundIdempotencyKey(userId, ["offer-reminder", "cand-1", "1"]);
    const first = await reserveUsage({
      userId,
      category: "creator_standard",
      operation: "automated_email_standard",
      idempotencyKey: key,
    });
    const second = await reserveUsage({
      userId,
      category: "creator_standard",
      operation: "automated_email_standard",
      idempotencyKey: key,
    });
    assert.equal(first.reservationId, second.reservationId);
    await commitUsage(first.reservationId);
    const third = await reserveUsage({
      userId,
      category: "creator_standard",
      operation: "automated_email_standard",
      idempotencyKey: key,
    });
    assert.equal(third.status, "committed");
    assert.equal(third.reservationId, first.reservationId);
  });

  it("creates three Free subscription records on signup initialization", async () => {
    if (!mongoReady) {
      process.env.MONGODB_URI = TEST_URI;
      await connectMongo();
      mongoReady = true;
    }
    const signupUser = await User.create({
      email: `billing-signup-${Date.now()}@example.com`,
      passwordHash: "test",
      username: `signup_${Date.now()}`,
      isVerified: true,
    });
    createdUserIds.push(signupUser._id);
    await initializeFreeEntitlements(signupUser._id.toString());
    const subs = await Subscription.find({ userId: signupUser._id }).lean().exec();
    assert.equal(subs.length, 3);
    assert.deepEqual(
      subs.map((sub) => sub.category).sort(),
      ["creator_form", "creator_standard", "seeker"],
    );
    for (const sub of subs) {
      assert.equal(sub.plan, "free");
      assert.equal(sub.status, "free");
      assert.equal(sub.provider, "razorpay");
    }
  });
});

describe("billing usage integration teardown", { skip: !canRun }, () => {
  it("disconnects mongoose", async () => {
    if (mongoReady) await mongoose.disconnect();
  });
});
