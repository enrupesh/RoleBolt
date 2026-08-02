---
name: Verified Razorpay integration
description: Phase 3 provider boundary, webhook authority, and activation safety rules
---

Razorpay integration uses server-owned plan IDs, checkout idempotency records, raw-body HMAC verification, event-ID/payload-hash idempotency, and lifecycle reconciliation. Checkout verification never activates access; only a validated webhook can update paid subscriptions.

**Why:** Browser redirects and client callbacks are not authoritative payment evidence, while webhook retries and out-of-order lifecycle events must not grant access or corrupt subscription state.

**How to apply:** Keep Razorpay credentials and plan IDs server-only. Configure them per environment, register the raw `/billing/webhook` route, and do not enable live paid access until Phase 4 route enforcement and database-backed integration tests pass.