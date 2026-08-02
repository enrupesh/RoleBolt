---
name: Root recruiter landing
description: The recruiter landing page is available at the root while the legacy /recruit URL remains a working deep link.
---

The root route renders the existing recruiter landing component directly instead of redirecting to `/recruit`; `/recruit` remains available for compatibility. Recruiter authentication and application links continue using their existing `/recruit/*` paths.

**Why:** The public homepage should have the clean canonical URL `/` without risking existing bookmarks, navigation, or recruiter deep links.

**How to apply:** Keep `/` and `/recruit` as equivalent landing entry points unless a deliberate redirect/canonical migration is planned. Route changes should preserve `/recruit/login`, `/recruit/signup`, dashboard, jobs, and public opportunities paths.