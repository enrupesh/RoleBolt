---
name: Copilot surface distinction
description: The recruiter Copilot has separate full-page workspace and contextual drawer surfaces that must be treated as distinct UI experiences.
---

The full-page `/recruit/copilot` workspace and the Standard/Form Job contextual Copilot drawers are separate surfaces. A polished drawer does not mean the workspace shown by a direct workspace URL has been redesigned.

**Why:** A screenshot review exposed that the full-page workspace could still show a blocking insights loader and an empty composer even after drawer styling was improved.

**How to apply:** When changing Copilot presentation, inspect and verify the global page for both `workspace=standard` and `workspace=form`, then inspect both contextual drawers separately. Keep the blocking insights state non-blocking so the welcome prompts and composer remain usable.