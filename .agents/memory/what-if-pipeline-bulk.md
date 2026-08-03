---
name: Pipeline sort/bulk + What-If Simulator
description: Standard Job pipeline sorting/bulk actions and rubric What-If Criteria Simulator
---

# Pipeline sort / bulk + What-If Simulator

## Pipeline (`jobs/[id]/page.tsx`)
- **Sort**: score high/low, newest/oldest, longest in stage, name A–Z
- **Bulk**: select cards / select all visible → Move to stage, Reject, Send assessment
- Uses existing PATCH candidate + assessment/send endpoints sequentially

## What-If Simulator (`WhatIfSimulator.tsx`)
On **Setup → Scoring Rubric**:
- Adjust agent shortlist/reject thresholds
- Adjust rubric criterion weights
- Live projection of Shortlist / Review / Reject / Unscored on current pipeline (re-weights existing breakdown scores — no AI until Apply & re-score)
- Shows who would change zones
- Actions: Apply thresholds only | Apply rubric weights | Apply & re-score early stages (applied/screened/rejected)

## Backend
`PATCH /recruit/jobs/:id` now accepts `rubric` (and `generatedJD`) for configure_job permission.
