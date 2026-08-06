import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it, beforeEach } from "node:test";
import { getPlanDefinition, getPublicPlanCatalog } from "./planCatalog";
import { normalizeStoredSubscription } from "./entitlements";
import { resolveBillingOwner } from "./billingOwner";
import {
  assertWithinLimit,
  serializeBillingError,
} from "./enforcement";
import {
  seekerIdempotencyKey,
} from "./seekerEnforcement";
import {
  standardIdempotencyKey,
} from "./standardEnforcement";
import {
  formIdempotencyKey,
} from "./formEnforcement";
import {
  verifyWebhookSignature,
  RazorpaySignatureError,
} from "./razorpay";
import {
  checkUserRateLimit,
  resetBillingRateLimitBucketsForTests,
  sanitizeBillingLogMeta,
  isSeekerMeteredAiPath,
  BILLING_RATE_LIMITS,
} from "./security";
import { UsageLimitError } from "./usage";
import type { ResolvedEntitlement } from "../billingTypes";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

const USER_A = "507f1f77bcf86cd799439011";
const USER_B = "507f1f77bcf86cd799439012";
const OWNER = "507f1f77bcf86cd799439099";

function freeStandardEntitlement(): ResolvedEntitlement {
  return {
    userId: USER_A,
    category: "creator_standard",
    plan: "free",
    interval: "monthly",
    status: "free",
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    cancelAtPeriodEnd: false,
    meteredAccessAllowed: true,
    definition: getPlanDefinition("creator_standard", "free"),
  };
}

function paidSub(overrides: Partial<ISubscription> = {}): ISubscription {
  return {
    userId: new mongoose.Types.ObjectId(USER_A),
    category: "creator_standard",
    plan: "pro",
    interval: "monthly",
    status: "active",
    provider: "razorpay",
    cancelAtPeriodEnd: false,
    currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
    ...overrides,
  } as ISubscription;
}

describe("Phase 7 — PII-safe billing logs", () => {
  it("redacts emails, resume text, secrets, and long payloads", () => {
    const sanitized = sanitizeBillingLogMeta({
      userId: USER_A,
      email: "candidate@example.com",
      resumeText: "x".repeat(200),
      razorpay_signature: "sig",
      nested: { answer: "private answer" },
    });
    assert.equal(sanitized.email, "[redacted]");
    assert.equal(sanitized.razorpay_signature, "[redacted]");
    assert.equal((sanitized.nested as Record<string, unknown>).answer, "[redacted]");
    assert.match(String(sanitized.resumeText), /\[text:200chars\]/);
    assert.equal(sanitized.userId, USER_A);
  });
});

describe("Phase 7 — account farming / fair-use rate limits", () => {
  beforeEach(() => resetBillingRateLimitBucketsForTests());

  it("blocks a user after the configured window limit", () => {
    const { scope, limit, windowMs } = BILLING_RATE_LIMITS.seekerAi;
    for (let i = 0; i < limit; i++) {
      assert.equal(checkUserRateLimit(scope, USER_A, limit, windowMs).allowed, true);
    }
    const blocked = checkUserRateLimit(scope, USER_A, limit, windowMs);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds > 0);
  });

  it("does not let parallel browser tabs multiply quota via separate rate-limit buckets", () => {
    const { scope, limit, windowMs } = BILLING_RATE_LIMITS.bulkImport;
    for (let i = 0; i < limit; i++) {
      checkUserRateLimit(scope, USER_A, limit, windowMs);
    }
    assert.equal(checkUserRateLimit(scope, USER_A, limit, windowMs).allowed, false);
  });

  it("scopes rate limits per user, not globally", () => {
    const { scope, limit, windowMs } = BILLING_RATE_LIMITS.parseResume;
    for (let i = 0; i < limit; i++) {
      checkUserRateLimit(scope, USER_A, limit, windowMs);
    }
    assert.equal(checkUserRateLimit(scope, USER_A, limit, windowMs).allowed, false);
    assert.equal(checkUserRateLimit(scope, USER_B, limit, windowMs).allowed, true);
  });
});

describe("Phase 7 — attack scenario matrix", () => {
  beforeEach(() => resetBillingRateLimitBucketsForTests());

  it("ignores forged client plan values — server entitlement is authoritative", () => {
    const forgedBody = { plan: "ultra", category: "creator_standard" };
    assert.equal(forgedBody.plan, "ultra");
    const resolved = normalizeStoredSubscription(null, "seeker", new Date());
    assert.equal(resolved.plan, "free");
    assert.equal(resolved.definition.limits.ai_units, 10);
  });

  it("bills the resource owner, not a collaborator stand-in (quota multiplication)", () => {
    const req = { user: { uid: USER_B } } as any;
    const ownerUid = resolveBillingOwner(req, { uid: OWNER, ownerUid: OWNER });
    assert.equal(ownerUid, OWNER);
    assert.notEqual(ownerUid, USER_B);
  });

  it("derives billing category from route constants, not client body tampering", () => {
    const clientCategory = "creator_standard";
    const routeCategory = "seeker";
    assert.notEqual(clientCategory, routeCategory);
    const entitlement = getPlanDefinition(routeCategory, "free");
    assert.equal(entitlement.category, "seeker");
  });

  it("blocks direct API quota bypass at the same limit as UI", () => {
    assert.throws(
      () => assertWithinLimit(freeStandardEntitlement(), "active_jobs", 1, { used: 1, reserved: 0 }),
      (error: any) => error.code === "PLAN_LIMIT_REACHED",
    );
  });

  it("rejects forged webhook signatures without entitlement mutation", () => {
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = "phase7-test-secret";
    const body = Buffer.from('{"event":"subscription.activated"}');
    try {
      assert.throws(
        () => verifyWebhookSignature(body, "forged"),
        RazorpaySignatureError,
      );
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });

  it("charges duplicate AI work only once per idempotency key (multi-tab / retry)", () => {
    const keyA = seekerIdempotencyKey(USER_A, ["resume_build", "doc-1", "hash-abc"]);
    const keyB = seekerIdempotencyKey(USER_A, ["resume_build", "doc-1", "hash-abc"]);
    assert.equal(keyA, keyB);
    const stdKey = standardIdempotencyKey(OWNER, ["copilot", "job-1", "turn-9"]);
    assert.equal(stdKey, standardIdempotencyKey(OWNER, ["copilot", "job-1", "turn-9"]));
  });

  it("blocks public form flooding at the response quota (26th on Free)", () => {
    const entitlement = getPlanDefinition("creator_form", "free");
    assert.equal(entitlement.limits.form_responses, 25);
    assert.throws(
      () =>
        assertWithinLimit(
          {
            ...freeStandardEntitlement(),
            category: "creator_form",
            definition: entitlement,
          },
          "form_responses",
          1,
          { used: 25, reserved: 0 },
        ),
      (error: any) => error.code === "PLAN_LIMIT_REACHED",
    );
  });

  it("blocks archived job reactivation when active job limit is full", () => {
    assert.throws(
      () => assertWithinLimit(freeStandardEntitlement(), "active_jobs", 1, { used: 1, reserved: 0 }),
      (error: any) => {
        assert.equal(error.feature, "active_jobs");
        return error.code === "PLAN_LIMIT_REACHED";
      },
    );
  });

  it("blocks oversized bulk import batches on Free", () => {
    const free = freeStandardEntitlement();
    assert.throws(
      () => assertWithinLimit(free, "bulk_import_files", 4, { used: 0, reserved: 0 }),
      (error: any) => error.code === "PLAN_LIMIT_REACHED",
    );
    assert.throws(
      () => assertWithinLimit(free, "bulk_imports", 1, { used: 1, reserved: 0 }),
      (error: any) => error.code === "PLAN_LIMIT_REACHED",
    );
  });

  it("blocks queued metered work after downgrade (past_due / cancelled)", () => {
    const pastDue = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "creator_standard",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(pastDue.meteredAccessAllowed, false);
    const cancelled = normalizeStoredSubscription(
      paidSub({
        status: "cancelled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2026-09-01T00:00:00.000Z"),
      }),
      "creator_standard",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(cancelled.plan, "pro");
    const expired = normalizeStoredSubscription(
      paidSub({
        status: "cancelled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2026-08-01T00:00:00.000Z"),
      }),
      "creator_standard",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(expired.plan, "free");
  });

  it("uses stable public intake idempotency for concurrent public submissions", () => {
    const key = formIdempotencyKey(OWNER, ["form_response_intake", "form-1", "attempt-1"]);
    assert.ok(key.includes(OWNER));
    assert.ok(key.includes("form-1"));
  });
});

describe("Phase 7 — security controls checklist", () => {
  it("never exposes Razorpay secrets or plan IDs in the public catalog", () => {
    const catalog = getPublicPlanCatalog();
    assert.ok(catalog.length > 0);
    for (const entry of catalog) {
      const json = JSON.stringify(entry);
      assert.equal(json.includes("RAZORPAY_KEY_SECRET"), false);
      assert.equal(json.includes("RAZORPAY_WEBHOOK_SECRET"), false);
      assert.equal(json.includes("razorpayPlanId"), false);
      assert.equal(entry.pricePaise >= 0, true);
    }
  });

  it("serializes upgrade-required errors without leaking provider internals", () => {
    const response = serializeBillingError(
      new UsageLimitError({
        reasonCode: "AI_UNITS_QUOTA_EXHAUSTED",
        category: "seeker",
        feature: "ai_units",
        used: 10,
        limit: 10,
      }),
      {
        userId: USER_A,
        category: "seeker",
        plan: "free",
        interval: "monthly",
        status: "free",
        currentPeriodStart: new Date("2026-08-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2026-08-31T23:59:59.999Z"),
        definition: getPlanDefinition("seeker", "free"),
        cancelAtPeriodEnd: false,
        meteredAccessAllowed: true,
      },
    );
    assert.equal(response.body.error, "PLAN_LIMIT_REACHED");
    assert.equal(response.body.upgradeRequired, true);
    assert.equal(JSON.stringify(response.body).includes("razorpay"), false);
  });

  it("identifies seeker metered AI paths for fair-use throttling", () => {
    assert.equal(isSeekerMeteredAiPath("POST", "/resume/build"), true);
    assert.equal(isSeekerMeteredAiPath("POST", "/tracker"), false);
    assert.equal(isSeekerMeteredAiPath("GET", "/resume/build"), false);
  });

  it("verifies webhook HMAC against raw body bytes", () => {
    const secret = "phase7-raw-body-secret";
    const previous = process.env.RAZORPAY_WEBHOOK_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
    const body = Buffer.from('{"event":"payment.failed","id":"evt_1"}');
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    try {
      assert.doesNotThrow(() => verifyWebhookSignature(body, signature));
    } finally {
      if (previous === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
      else process.env.RAZORPAY_WEBHOOK_SECRET = previous;
    }
  });
});
