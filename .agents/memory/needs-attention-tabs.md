---
name: Needs attention + tab grouping
description: Standard Job daily UX — NeedsAttentionQueue and JobTabNav (5 groups)
---

# Needs Attention Queue + Tab Grouping

## Tab groups (`JobTabNav.tsx`)
Primary nav on `/recruit/jobs/[id]`:
1. **Pipeline** — candidates
2. **Autopilot** — Hiring Autopilot hub
3. **Setup** — JD, Rubric, Post to Boards (sub-tabs)
4. **Insights** — Job Analysis, Assessment Analytics, Live Progress, AI Hiring (sub-tabs)
5. **Team** — Collaboration

Deep links by `?tab=` still work; group is derived from active tab.

## Needs Attention (`NeedsAttentionQueue.tsx`)
Strip above tabs. Builds up to 8 prioritized items from:
- Scoring failed
- Assessment completed (Strong Yes / Maybe) awaiting stage move
- Assessment overdue (sent ≥5 days)
- Offer awaiting response / near expiry
- Stuck in Applied / review zone ≥5 days
- AI hiring recommendation without recruiter decision
- Job health alerts (→ Autopilot health)

CTA jumps to pipeline (with stage filter + scroll/highlight) or Autopilot/AI Hiring tab.
