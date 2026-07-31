---
name: Collaboration access boundary
description: The authorization rule for multi-recruiter access across existing ATS workflows.
---

Existing ATS actions that operate on owner-owned jobs or candidates must first resolve the job-scoped collaboration access record and check the action permission. The candidate query can then use the job owner's UID from that access record, rather than the acting user's UID.

**Why:** Team members need to collaborate without weakening the original ownership boundary; owner-only lookups silently block valid collaborators, while broad candidate queries could expose unrelated records.

**How to apply:** When adding or modifying recruiter actions—especially assessments, interviews, offers, stage changes, notes, and candidate exports—reuse the collaboration access/permission check before querying or mutating candidate data, and record important collaboration activity.