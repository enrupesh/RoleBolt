import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "./api";
import {
  billingHref,
  counterLabel,
  formatInrPaise,
  formatLimit,
  highlightLimits,
  isUpgradeRequiredError,
  newIdempotencyKey,
  pricingHref,
} from "./billing";

describe("billing helpers", () => {
  it("formats INR paise for monthly and yearly plans", () => {
    assert.equal(formatInrPaise(9900, "monthly"), "₹99/mo");
    assert.equal(formatInrPaise(99900, "yearly"), "₹999/yr");
    assert.equal(formatInrPaise(0, "monthly"), "₹0");
  });

  it("formats unlimited and finite limits", () => {
    assert.equal(formatLimit(null), "Unlimited");
    assert.equal(formatLimit(25), "25");
  });

  it("labels counters for human-readable UI", () => {
    assert.equal(counterLabel("ai_units"), "Ai Units");
    assert.equal(counterLabel("form_responses"), "Form Responses");
  });

  it("builds stable billing and pricing hrefs", () => {
    assert.equal(pricingHref("seeker"), "/recruit/pricing?category=seeker");
    assert.equal(billingHref("creator_form", { checkout: "pending" }), "/recruit/billing?category=creator_form&checkout=pending");
  });

  it("highlights visible catalog limits per category", () => {
    const lines = highlightLimits("seeker", {
      ai_units: 10,
      cover_letters: 2,
      workspace_items: 3,
    });
    assert.ok(lines.some((line) => line.includes("Ai Units: 10")));
    assert.ok(lines.some((line) => line.includes("Cover Letters: 2")));
  });

  it("generates idempotency keys with a stable prefix", () => {
    const key = newIdempotencyKey("checkout_seeker_pro_monthly");
    assert.ok(key.startsWith("checkout_seeker_pro_monthly_"));
    assert.ok(key.length > "checkout_seeker_pro_monthly_".length);
  });

  it("detects upgrade-required errors from stable API codes only", () => {
    const limitError = new ApiError(409, {
      error: "PLAN_LIMIT_REACHED",
      upgradeRequired: true,
      feature: "ai_units",
    }, "Limit reached");
    const featureError = new ApiError(403, {
      error: "FEATURE_NOT_AVAILABLE",
      upgradeRequired: true,
    }, "Feature locked");
    const genericError = new ApiError(500, { error: "INTERNAL_ERROR" }, "Server error");

    assert.equal(isUpgradeRequiredError(limitError), true);
    assert.equal(isUpgradeRequiredError(featureError), true);
    assert.equal(isUpgradeRequiredError(genericError), false);
    assert.equal(isUpgradeRequiredError(new Error("network")), false);
  });
});
