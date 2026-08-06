---
name: Billing foundation
description: Durable Phase 1 billing architecture and activation boundary
---

The billing foundation is provider-ready but provider-disabled. Entitlements are resolved by category (`seeker`, `creator_form`, `creator_standard`) and only a verified Razorpay subscription with an active, non-expired period can produce a paid plan. Legacy Stripe records are compatibility data, not access grants.

**Why:** The monetization contract requires backend-owned access decisions, independent category plans, safe Free fallback, and no activation from checkout redirects or unverified provider data.

**How to apply:** Future Razorpay checkout/webhook work must preserve the existing subscription status boundary, BillingEvent idempotency record, usage-period snapshots, and transactional UsageLedger reservation/commit/release flow. Do not enable paid access until route enforcement and provider verification are complete.