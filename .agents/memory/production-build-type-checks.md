---
name: Production build type checks
description: Durable lessons from strict Next.js production builds in this imported project.
---

Run the full frontend production build after changes, not only the touched route. Shared auth context fields and reusable typed data arrays can have stale consumers elsewhere in the app; the compiler will reveal them one at a time.

**Why:** The deployment build found two old consumers still destructuring a renamed auth field, followed by a missing required description in a shared email-template entry. Neither issue was visible from the landing-page preview.

**How to apply:** After frontend changes or dependency updates, run `cd frontend && npm run build` and fix the first type error without weakening the shared type. Keep related UI consumers aligned with the current context contract.