---
name: Central entitlement enforcement
description: Phase 2 enforcement boundary and route-adoption rule
---

Central billing enforcement lives behind server-resolved entitlements: feature flags, finite/unlimited counter checks, owner-scoped resource counting, stable limit errors, and reusable Express middleware. Undefined counters fail closed.

**Why:** Scattered plan checks are bypass-prone and cannot consistently account for reservations, resource ownership, or stable client error codes.

**How to apply:** Every future protected route must choose its category, owner scope, feature key, resource counter, AI operation, and idempotency behavior, then use this boundary before creating resources or invoking AI. Route adoption is incomplete until each route family is explicitly mapped.