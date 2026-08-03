---
name: Frontend build dependency hoisting
description: Imported standalone Recruit workspace has hoisted dependencies that trigger Next 16 Turbopack root-resolution failures.
---

Use the frontend's stable webpack mode for development and production builds when dependencies are installed at the workspace root. Next 16 Turbopack can infer `src/app` as the project root and reject the hoisted package layout even when `turbopack.root` is configured.

**Why:** The imported two-part project does not start with a frontend-local dependency installation, and Turbopack's resolver is stricter about that layout than webpack.

**How to apply:** Keep the existing frontend workflow commands, but use `next dev --webpack` and `next build --webpack`; preserve the frontend package manifest and lockfile as the dependency source of truth.