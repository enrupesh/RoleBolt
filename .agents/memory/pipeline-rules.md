---
name: Pipeline Rules feature
description: Feature 1.2 — AI Pipeline Manager; where rules live, how they fire, trigger points
---

# AI Pipeline Rules (Feature 1.2)

## Model
`pipelineRules: IPipelineRule[]` added to `RecruitJob` model (`backend/src/models/RecruitJob.ts`).
Each rule has: `id` (UUID), `condition`, `threshold`, `fromStage`, `action`, `enabled`, `triggerCount`.

## Backend function
`evaluatePipelineRules(jobId, candidateId)` in `backend/src/recruit.ts` (just below `getUid`).
Always call via `setImmediate(() => evaluatePipelineRules(...).catch(...))` — never await it inside a route handler.

## Trigger points (all non-blocking via setImmediate)
1. POST /recruit-public/jobs/:id/apply — after candidate saved + agent-mode block
2. PATCH /recruit/jobs/:id/candidates/:cid — after manual stage change
3. Public assessment submit route — after `candidate.save()`

## CRUD routes (all protected, require Bearer JWT)
- GET  /recruit/jobs/:id/pipeline-rules
- POST /recruit/jobs/:id/pipeline-rules
- PATCH /recruit/jobs/:id/pipeline-rules/:ruleId
- DELETE /recruit/jobs/:id/pipeline-rules/:ruleId

**Why:** Plan says pipeline rules handle post-application stage automation; must be non-blocking and not conflict with agent-mode (they can chain after it).

## Frontend
New "Pipeline Rules" tab in `/recruit/jobs/[id]/page.tsx`.
`PipelineRulesTab` component at bottom of file (above `PostToBoardsTab`).
Tab shows active rule count badge. Rules fetch alongside job+candidates in `fetchData`.
