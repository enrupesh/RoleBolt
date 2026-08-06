---
name: Private job visibility
description: Privacy and lifecycle rules for Standard Jobs marked private
---

Private Standard Jobs are owner-only workspaces. They must not be discoverable or reachable through public job lists, detail pages, recruiter/company profiles, recommendations, alerts, matching, saved jobs, or seeker application routes. A private job cannot be made public again; publishing later requires a new job.

**Why:** A shareable identifier must not become an access path around the creator’s explicit decision not to publish a role.

**How to apply:** Keep public/seeker queries explicitly constrained to `publicVisibility != false`, and enforce owner-only behavior at the shared job collaboration access boundary so collaborator routes cannot expose private jobs.