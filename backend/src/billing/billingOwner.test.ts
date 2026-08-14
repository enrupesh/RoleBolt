import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveBillingOwner, requireBillingOwnerUid } from "./billingOwner";
import type express from "express";

function fakeReq(uid?: string): express.Request {
  return { user: uid ? { uid } : undefined } as unknown as express.Request;
}

describe("billing owner resolution", () => {
  it("prefers resource.ownerUid over resource.uid and request user", () => {
    assert.equal(
      resolveBillingOwner(fakeReq("requester"), { ownerUid: "owner-1", uid: "resource-uid" }),
      "owner-1",
    );
  });

  it("falls back to resource.uid for owned documents", () => {
    assert.equal(
      resolveBillingOwner(fakeReq("requester"), { uid: "resource-owner" }),
      "resource-owner",
    );
  });

  it("falls back to authenticated request user when no resource is supplied", () => {
    assert.equal(resolveBillingOwner(fakeReq("self-user")), "self-user");
  });

  it("requireBillingOwnerUid throws when no owner can be resolved", () => {
    assert.throws(
      () => requireBillingOwnerUid(fakeReq()),
      (error: Error) => error.message.includes("could not be resolved"),
    );
  });
});
