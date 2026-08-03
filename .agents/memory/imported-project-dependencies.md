---
name: Imported project dependencies
description: Environment-specific dependency behavior for this split frontend/backend import.
---

The imported project has separate frontend and backend package manifests, while the configured workflows resolve dependencies from the workspace root. A workflow can fail with a missing package even when that package is declared in the child manifest until the workspace dependency installation is complete.

**Why:** The first frontend and backend failures were missing runtime modules rather than source-code regressions; the root workspace uses hoisted pnpm resolution for the configured commands.

**How to apply:** When an imported workflow reports a missing module, inspect both child manifests and the root dependency state before changing application code. Preserve the existing child package manifests and install only declared dependencies.