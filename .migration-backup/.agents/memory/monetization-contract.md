---
name: Monetization contract
description: The approved monetization direction and the source-of-truth payment implementation specification.
---

`payment.md` defines three independent category entitlements: Job Seeker, Creator Form Jobs, and Creator Standard Jobs. Each has Free, Pro, and Ultra Pro plans with strict capacity-based limits, central server-side entitlement checks, atomic usage reservations, and Razorpay-controlled paid access.

**Why:** Free must demonstrate the product without replacing paid usage, while direct API calls, background jobs, public form submissions, and concurrent requests must not bypass plan limits.

**How to apply:** Treat `payment.md` as the contract before implementing billing. Keep pricing/limits in a backend-owned plan catalog, keep Razorpay behind a provider boundary, and preserve data on downgrade while blocking over-limit new work.