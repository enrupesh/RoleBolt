---
name: Pipeline Rules feature
description: Feature 1.2 — AI Pipeline Manager; where rules live, how they fire, trigger points
---

# AI Pipeline Rules (Feature 1.2)

## Model
`pipelineRules: IPipelineRule[]` on `RecruitJob`. Per-candidate dedup via `pipelineRuleState: Record<string, string>` on `RecruitCandidate`.

Actions: stage moves (incl. `move_to_assessed`), `send_assessment`, `send_reminder`.

## Backend function
`evaluatePipelineRules(jobId, candidateId)` in `backend/src/recruit.ts` — exported for cron use.
Always call via `schedulePipelineRules(jobId, candidateId)` — never await in route handlers.
First matching rule fires, then stops.

## Trigger points (non-blocking)
1. POST /recruit-public/jobs/:id/apply — after candidate saved + agent block
2. POST /recruit/jobs/:id/candidates — manual add (agent + rules)
3. POST /recruit/jobs/:id/candidates/bulk — pipeline rules only (no agent per product decision)
4. POST /recruit/seeker/jobs/:id/apply — agent + rules
5. POST /recruit/jobs/:id/candidates/:cid/retry-score — clears score rule state, re-runs agent (early stages) + rules
6. PATCH /recruit/jobs/:id/candidates/:cid — after manual stage change
7. Public assessment submit — after save (sets stageMovedAt)
8. Daily cron (`pipelineRulesCron.ts` 06:00 UTC) — `stage_age_days` sweep

## CRUD routes
Use `getCollaborationAccess`: read requires `view_candidates`, write requires `configure_job`.

## Frontend
Pipeline Rules tab in `/recruit/jobs/[id]/page.tsx`. Deep link candidates: `?tab=pipeline&candidate={id}`.
