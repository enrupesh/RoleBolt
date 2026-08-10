import type express from "express";

export interface BillingOwnerResource {
  uid?: string;
  ownerUid?: string;
}

/**
 * Resolves the account that should be billed for a request.
 * Collaborators act on behalf of the resource owner — never their personal entitlements.
 */
export function resolveBillingOwner(
  req: express.Request,
  resource?: BillingOwnerResource | null,
): string {
  if (resource?.ownerUid?.trim()) return resource.ownerUid.trim();
  if (resource?.uid?.trim()) return resource.uid.trim();
  return ((req as express.Request & { user?: { uid?: string } }).user?.uid ?? "").trim();
}

export function requireBillingOwnerUid(
  req: express.Request,
  resource?: BillingOwnerResource | null,
): string {
  const ownerUid = resolveBillingOwner(req, resource);
  if (!ownerUid) throw new Error("Billing owner could not be resolved.");
  return ownerUid;
}
