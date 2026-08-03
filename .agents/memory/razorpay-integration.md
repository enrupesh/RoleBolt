---
name: Verified Razorpay integration
description: Phase 3 provider boundary, webhook authority, and activation safety rules
---

Razorpay integration uses server-owned plan IDs, checkout idempotency records, raw-body HMAC verification, event-ID/payload-hash idempotency, and lifecycle reconciliation. Checkout verification never activates access; only a validated webhook can update paid subscriptions.

**Why:** Browser redirects and client callbacks are not authoritative payment evidence, while webhook retries and out-of-order lifecycle events must not grant access or corrupt subscription state.

**How to apply:** Keep Razorpay credentials and plan IDs server-only. Configure them per environment, register the raw `/billing/webhook` route, and do not enable live paid access until Phase 4 route enforcement and database-backed integration tests pass.

Razorpay subscription Checkout shows a dynamic UPI QR as the documented desktop fallback. Mobile UPI Intent requires Razorpay-side enablement; it cannot be created by adding a browser camera scanner.

**Why:** The QR on a subscription mandate is a payment approval QR, not a scanner control. Forcing unsupported Checkout options can break the payment flow. Razorpay also requires customer contact context (`prefill.contact` + subscription `notify_info`) for reliable UPI Autopay QR generation.

**How to apply:** Use Razorpay's default subscription Checkout options so its QR rendering remains intact. Always pass server-built checkout prefill (name/email/phone) from `/billing/create-checkout` into Checkout.js, and create subscriptions with matching `notify_info`. Never use a frontend-only Razorpay key fallback that can mismatch the server key used to create the subscription.