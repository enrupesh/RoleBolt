import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BILLING_CATEGORIES,
  BILLING_INTERVALS,
  BILLING_PLANS,
} from "../billingTypes";
import { assertCatalogComplete, getPlanDefinition } from "./planCatalog";
import { getCalendarPeriod, getPeriodWindow } from "./periods";
import { getBillingOperation, assertOperationCatalogComplete } from "./operationCatalog";

describe("billing plan catalog", () => {
  it("contains every category, plan, and interval", () => {
    assertCatalogComplete();
    for (const category of BILLING_CATEGORIES) {
      for (const plan of BILLING_PLANS) {
        for (const interval of BILLING_INTERVALS) {
          const definition = getPlanDefinition(category, plan, interval);
          assert.equal(definition.category, category);
          assert.equal(definition.plan, plan);
          assert.equal(definition.interval, interval);
          assert.ok(definition.pricePaise >= 0);
          assert.ok(definition.limits.ai_units !== undefined);
        }
      }
    }
  });

  it("keeps legacy provider identifiers out of public catalog output", () => {
    const definition = getPlanDefinition("creator_standard", "pro", "monthly");
    assert.equal(definition.razorpayPlanId, "");
    assert.equal(definition.pricePaise, 99900);
  });
});

describe("billing periods", () => {
  it("creates a UTC calendar month", () => {
    const period = getCalendarPeriod(new Date("2026-08-02T12:00:00.000Z"));
    assert.equal(period.periodKey, "2026-08");
    assert.equal(period.periodStart.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(period.periodEnd.toISOString(), "2026-08-31T23:59:59.999Z");
  });

  it("prefers provider period boundaries when both exist", () => {
    const start = new Date("2026-08-17T00:00:00.000Z");
    const end = new Date("2026-09-17T00:00:00.000Z");
    const period = getPeriodWindow("monthly", new Date("2026-08-02T00:00:00.000Z"), start, end);
    assert.equal(period.periodStart.toISOString(), start.toISOString());
    assert.equal(period.periodEnd.toISOString(), end.toISOString());
  });
});

describe("billing operation catalog", () => {
  it("covers every Phase -1 required operation key", () => {
    assertOperationCatalogComplete();
  });

  it("assigns the documented AI weights", () => {
    assert.equal(getBillingOperation("cover_letter").units, 2);
    assert.equal(getBillingOperation("interview_session").units, 3);
    assert.equal(getBillingOperation("form_hiring_summary").units, 4);
  });

  it("rejects unknown operations", () => {
    assert.throws(() => getBillingOperation("not_a_real_operation"), /Unknown billing operation/);
  });
});