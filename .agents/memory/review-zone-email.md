---
name: Review Zone Email feature
description: How the emailReviewZoneCandidates agent setting works and where it's wired in.
---

## Rule
Candidates with a score between `rejectThreshold` and `shortlistThreshold` are in the Review Zone.
When `agentMode.emailReviewZoneCandidates === true`, the system sends a single "Your application is under review" email immediately after the candidate is created (non-blocking `setImmediate`).

**Why:** One-time send per application is guaranteed by the fact that the email fires only once in the apply flow at candidate creation — no re-trigger exists.

## How to apply
- `IAgentMode` and `AgentModeSchema` in `backend/src/models/RecruitJob.ts` now include `emailReviewZoneCandidates: boolean` (default `false`).
- `IAgentActionEntry.action` in `backend/src/models/RecruitCandidate.ts` includes `"review_zone"`.
- Scoring decision in `backend/src/recruit.ts` sets `agentAction = "review_zone"` when score is in the middle band.
- Email dispatch block in `recruit.ts` handles `agentAction === "review_zone"` → calls `emailTemplates.reviewZoneEmail()`, logs `type: "agent_review_zone"` in `emailLog`, and writes a `review_zone` entry to `agentLog`.
- PATCH `/recruit/jobs/:jobId/agent-mode` now accepts and persists `emailReviewZoneCandidates`.
- Frontend `AgentMode` type includes `emailReviewZoneCandidates`; amber toggle added in the "Automatic Emails" section of Agent Settings panel.
- Email template is `reviewZoneEmail()` in `backend/src/emailTemplates.ts` (uses the shared `shell()` wrapper).
