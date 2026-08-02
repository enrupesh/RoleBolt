---
name: Standard Job completion checklist
description: P0–P3 Standard Job full completion items and how to verify
---

# Standard Job — Full Completion

## P0 Reliability
- Pure core: `backend/src/automation/standardJobCore.ts`
- Tests: `backend/src/automation/standardJobCore.test.ts`
- What-If: `frontend/src/lib/whatIfSimulation.ts` + `.test.ts`
- Run: `cd backend && npm test` · `cd frontend && npm test` (needs `tsx` + Node 20)

## P1 Hiring Timeline
- `frontend/.../HiringTimeline.tsx` — expand candidate card → Timeline + Export/Copy record

## P2 UX
- `review_zone` stage everywhere (pipeline, funnel APIs, analytics colors, Needs Attention, Autopilot stats click-through)
- `JobPageTour.tsx` — first visit localStorage `recruit_job_page_tour_v1`
- Dashboard `PostCreateChecklist` — key `recruit_post_create_checklist` set on job create
- Needs-attention: 8 types — scoring fail, assessment ready, assessment overdue, offer pending, stale applied, stale review_zone, AI rec pending, health alerts

## P3
- Talent Pool: star/note/reuse (`POST /talent-pool/:id/reuse`), deep links; no Coming Soon
- Job page Copilot drawer (`CopilotDrawer.tsx`) — job-level stream
