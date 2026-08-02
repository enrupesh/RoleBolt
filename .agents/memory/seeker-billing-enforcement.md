---
name: Seeker billing enforcement
description: Durable rules for metering seeker AI actions, active applications, idempotency, and stable quota errors.
---

Seeker AI operations must reserve once around the complete provider fallback chain, while request retries reuse an explicit request idempotency key. Do not use deterministic content-only keys for normal user actions, because re-analysis or regenerated content can be a legitimate new operation.

**Why:** Content-only keys made valid cover-letter and workspace re-analysis attempts look like already-completed requests. A fresh key per logical action preserves usability while an explicit retry key preserves single-charge behavior.

**How to apply:** Use the shared seeker billing wrapper at the logical operation boundary. Use `Idempotency-Key` when retrying the same request, and keep resource-limit checks separate so manual edits remain available after AI quota exhaustion.

Active seeker applications can exist as tracker entries, applied workspace items, or recruiter-side candidate records linked by seeker email. Any active-application limit check must count all three representations.

**Why:** One-click applications and workspace records otherwise create separate representations that can bypass the same plan cap.

**How to apply:** Update every new active-stage transition and keep the counter definitions aligned with the canonical active-stage sets.