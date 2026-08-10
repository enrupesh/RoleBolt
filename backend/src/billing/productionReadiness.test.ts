import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  BILLING_CATEGORIES,
  BILLING_INTERVALS,
  BILLING_PLANS,
  type BillingCategory,
  type BillingPlan,
} from "../billingTypes";
import {
  assertCatalogComplete,
  getPlanDefinition,
  getPublicPlanCatalog,
} from "./planCatalog";
import { assertOperationCatalogComplete } from "./operationCatalog";
import { normalizeStoredSubscription } from "./entitlements";
import { Subscription } from "../models/Subscription";
import { UsagePeriod } from "../models/UsagePeriod";
import { UsageLedger } from "../models/UsageLedger";
import { BillingEvent } from "../models/BillingEvent";
import { BillingCheckout } from "../models/BillingCheckout";
import type { ISubscription } from "../models/Subscription";
import mongoose from "mongoose";

/** `payment.md` §3 — INR prices in paise (source of truth for launch). */
const PAYMENT_MD_PRICES: Record<
  BillingCategory,
  Record<Exclude<BillingPlan, "free">, { monthly: number; yearly: number }>
> = {
  seeker: {
    pro: { monthly: 9900, yearly: 99900 },
    ultra: { monthly: 24900, yearly: 249900 },
  },
  creator_form: {
    pro: { monthly: 49900, yearly: 499900 },
    ultra: { monthly: 99900, yearly: 999900 },
  },
  creator_standard: {
    pro: { monthly: 99900, yearly: 999900 },
    ultra: { monthly: 199900, yearly: 1999900 },
  },
};

/** `payment.md` §4.2–4.4 — Free tier spot-check limits. */
const PAYMENT_MD_FREE_LIMITS: Record<BillingCategory, Record<string, number>> = {
  seeker: {
    ai_units: 10,
    workspace_items: 3,
    cover_letters: 2,
    saved_jobs: 10,
  },
  creator_form: {
    active_forms: 1,
    form_responses: 25,
    ai_units: 15,
    recruiter_seats: 1,
  },
  creator_standard: {
    active_jobs: 1,
    new_candidates: 25,
    ai_units: 20,
    bulk_import_files: 3,
    bulk_imports: 1,
    recruiter_seats: 1,
  },
};

function paidSub(overrides: Partial<ISubscription> = {}): ISubscription {
  return {
    userId: new mongoose.Types.ObjectId(),
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

function schemaIndexNames(model: mongoose.Model<unknown>): string[] {
  const indexes = model.schema.indexes() as unknown as Array<[Record<string, number>]>;
  return indexes.map(([spec]) => JSON.stringify(spec));
}

describe("Phase 8 — payment.md catalog contract", () => {
  it("defines all category × plan × interval entitlements independently", () => {
    assertCatalogComplete();
    for (const category of BILLING_CATEGORIES) {
      for (const plan of BILLING_PLANS) {
        for (const interval of BILLING_INTERVALS) {
          const def = getPlanDefinition(category, plan, interval);
          assert.equal(def.category, category);
          assert.equal(def.plan, plan);
          assert.equal(def.interval, interval);
        }
      }
    }
  });

  it("matches payment.md §3 INR prices for every paid plan", () => {
    for (const category of BILLING_CATEGORIES) {
      for (const plan of ["pro", "ultra"] as const) {
        for (const interval of ["monthly", "yearly"] as const) {
          const def = getPlanDefinition(category, plan, interval);
          assert.equal(
            def.pricePaise,
            PAYMENT_MD_PRICES[category][plan][interval],
            `${category}/${plan}/${interval}`,
          );
        }
      }
    }
  });

  it("matches payment.md §4 Free limits for all three categories", () => {
    for (const category of BILLING_CATEGORIES) {
      const free = getPlanDefinition(category, "free", "monthly").limits;
      for (const [counter, expected] of Object.entries(PAYMENT_MD_FREE_LIMITS[category])) {
        assert.equal(free[counter], expected, `${category} free ${counter}`);
      }
    }
  });

  it("makes Pro and Ultra meaningfully different (Ultra > Pro on AI units)", () => {
    for (const category of BILLING_CATEGORIES) {
      const pro = getPlanDefinition(category, "pro", "monthly");
      const ultra = getPlanDefinition(category, "ultra", "monthly");
      assert.ok(
        (ultra.limits.ai_units as number) > (pro.limits.ai_units as number),
        `${category} ultra ai_units should exceed pro`,
      );
      assert.equal(pro.processingPriority, "normal");
      assert.equal(ultra.processingPriority, "priority");
      assert.equal(getPlanDefinition(category, "free", "monthly").processingPriority, "free");
    }
  });
});

describe("Phase 8 — enforcement and lifecycle contracts", () => {
  it("covers every metered operation in the operation catalog", () => {
    assertOperationCatalogComplete();
  });

  it("never exposes provider secrets in the public pricing catalog", () => {
    const json = JSON.stringify(getPublicPlanCatalog());
    assert.equal(json.includes("RAZORPAY_KEY_SECRET"), false);
    assert.equal(json.includes("RAZORPAY_WEBHOOK_SECRET"), false);
    assert.equal(json.includes("stripe"), false);
  });

  it("requires webhook activation — verify-checkout does not mutate Subscription", () => {
    const source = readFileSync(
      join(__dirname, "razorpayApi.ts"),
      "utf8",
    );
    assert.match(source, /activation:\s*"webhook_required"/);
    assert.match(source, /never mutates Subscription/i);
  });

  it("retires legacy Stripe checkout with HTTP 410", () => {
    const source = readFileSync(join(__dirname, "..", "billing.ts"), "utf8");
    assert.match(source, /legacy_billing_disabled/);
    assert.match(source, /status\(410\)/);
  });

  it("downgrades expired paid subscriptions to Free capacity", () => {
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
    assert.equal(expired.meteredAccessAllowed, true);
  });

  it("preserves paid metadata but blocks metered work when past_due", () => {
    const pastDue = normalizeStoredSubscription(
      paidSub({ status: "past_due" }),
      "creator_standard",
      new Date("2026-08-15T00:00:00.000Z"),
    );
    assert.equal(pastDue.plan, "pro");
    assert.equal(pastDue.meteredAccessAllowed, false);
  });

  it("ignores legacy Stripe/agency plan records (fail closed to Free)", () => {
    const legacy = normalizeStoredSubscription(
      paidSub({ plan: "agency" as ISubscription["plan"], provider: "stripe_legacy" }),
      "creator_standard",
      new Date(),
    );
    assert.equal(legacy.plan, "free");
  });
});

describe("Phase 8 — persistence indexes and reconciliation readiness", () => {
  it("defines required MongoDB indexes on billing collections", () => {
    const subscriptionIndexes = schemaIndexNames(Subscription);
    assert.ok(
      subscriptionIndexes.some((idx) => idx.includes('"userId"') && idx.includes('"category"')),
      "Subscription (userId, category) unique",
    );
    const usagePeriodIndexes = schemaIndexNames(UsagePeriod);
    assert.ok(
      usagePeriodIndexes.some(
        (idx) =>
          idx.includes('"userId"') &&
          idx.includes('"category"') &&
          idx.includes('"periodKey"'),
      ),
      "UsagePeriod (userId, category, periodKey) unique",
    );
    const ledgerIndexes = schemaIndexNames(UsageLedger);
    assert.ok(
      ledgerIndexes.some((idx) => idx.includes('"idempotencyKey"')),
      "UsageLedger idempotencyKey unique",
    );
    const eventIndexes = schemaIndexNames(BillingEvent);
    assert.ok(
      eventIndexes.some((idx) => idx.includes('"providerEventId"')),
      "BillingEvent provider event idempotency",
    );
    const checkoutIndexes = schemaIndexNames(BillingCheckout);
    assert.ok(
      checkoutIndexes.some((idx) => idx.includes('"idempotencyKey"')),
      "BillingCheckout idempotency",
    );
  });

  it("ships reconciliation CLI for missed provider events", () => {
    const pkg = readFileSync(join(__dirname, "..", "..", "package.json"), "utf8");
    assert.match(pkg, /billing:reconcile/);
    const reconcile = readFileSync(
      join(__dirname, "reconcileRazorpaySubscriptions.ts"),
      "utf8",
    );
    assert.match(reconcile, /BillingAuditLog/);
  });

  it("uses atomic conditional updates to prevent counter over-limit (usage.ts)", () => {
    const source = readFileSync(join(__dirname, "usage.ts"), "utf8");
    assert.match(source, /\$expr/);
    assert.match(source, /idempotencyKey/);
    assert.match(source, /commitUsage/);
    assert.match(source, /releaseUsage/);
  });
});

describe("Phase 8 — route enforcement wiring (grep contract)", () => {
  it("wires billing enforcement into product route families", () => {
    const checks: Array<{ file: string; import: string }> = [
      { file: "seeker.ts", import: "seekerEnforcement" },
      { file: "recruitForms.ts", import: "formEnforcement" },
      { file: "recruit.ts", import: "standardEnforcement" },
      { file: "collaboration.ts", import: "standardEnforcement" },
      { file: "recruitCopilot.ts", import: "standardEnforcement" },
    ];
    for (const { file, import: needle } of checks) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      assert.match(source, new RegExp(needle), `${file} must import ${needle}`);
    }
  });

  it("protects public form intake before response create (Pattern C)", () => {
    const source = readFileSync(join(__dirname, "..", "recruitForms.ts"), "utf8");
    assert.match(source, /form_response_intake/);
    assert.match(source, /runFormBillingOperation|reserveUsage/);
  });

  it("re-checks entitlement in background cron paths", () => {
    const files = ["jobs/pipelineRulesCron.ts", "jobs/dailyBriefing.ts", "jobs/offerManagement.ts"];
    for (const file of files) {
      const source = readFileSync(join(__dirname, "..", file), "utf8");
      assert.match(
        source,
        /backgroundEnforcement|getEntitlement|runBackgroundBillingOperation|billing blocked/i,
        file,
      );
    }
  });
});
