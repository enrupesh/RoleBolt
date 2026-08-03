import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOperationCatalogComplete,
  getBillingOperation,
  REQUIRED_BILLING_OPERATION_KEYS,
  BILLING_OPERATIONS,
} from "./operationCatalog";

describe("billing operation catalog", () => {
  it("includes every required Phase -1 / payment.md operation key", () => {
    assert.doesNotThrow(() => assertOperationCatalogComplete());
    for (const key of REQUIRED_BILLING_OPERATION_KEYS) {
      const operation = getBillingOperation(key);
      assert.equal(operation.key, key);
      assert.ok(["seeker", "creator_form", "creator_standard"].includes(operation.category));
      assert.ok(Number.isFinite(operation.units));
      assert.ok(operation.units >= 0);
    }
  });

  it("matches payment.md AI unit weights for core operations", () => {
    assert.equal(getBillingOperation("candidate_score").units, 1);
    assert.equal(getBillingOperation("form_response_score").units, 1);
    assert.equal(getBillingOperation("cover_letter").units, 2);
    assert.equal(getBillingOperation("resume_analysis").units, 2);
    assert.equal(getBillingOperation("job_fit_analysis").units, 2);
    assert.equal(getBillingOperation("deep_candidate_analysis").units, 2);
    assert.equal(getBillingOperation("interview_session").units, 3);
    assert.equal(getBillingOperation("job_analysis").units, 3);
    assert.equal(getBillingOperation("offer_letter_draft").units, 3);
    assert.equal(getBillingOperation("form_hiring_summary").units, 4);
  });

  it("fails closed for unknown operations", () => {
    assert.throws(
      () => getBillingOperation("not_a_real_operation"),
      (error: Error) => error.message.includes("Unknown billing operation"),
    );
  });

  it("exposes a non-empty frozen catalog map", () => {
    assert.ok(BILLING_OPERATIONS.size >= REQUIRED_BILLING_OPERATION_KEYS.length);
  });
});
