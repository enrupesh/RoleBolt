---
name: seo.ts programmatic trim lesson
description: Risk of leaving duplicate syntax when trimming large exported objects via Python script
---

When using a Python script to splice out sections of a TypeScript file that contains `} as const;` as a closing delimiter:

**The rule:** After any programmatic large-file edit, immediately read back the boundary lines (start and end of the edited section) to confirm no duplicate closing tokens were introduced before restarting workflows.

**Why:** The script appended `\n} as const;\n\n` as the new closing while the original `} as const;` text was already present in the `after` slice. This produced a duplicate and caused a 500 error in Next.js.

**How to apply:** Whenever slicing file content around a known delimiter (like `} as const;`), ensure the boundary variable (`pk_end`) points to the character *before* the delimiter, then include the delimiter exactly once in the reconstructed string — not in both the reconstructed block and the `after` slice.
