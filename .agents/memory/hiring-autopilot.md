---
name: Hiring Autopilot hub
description: Standard Job Autopilot tab unifies AI Agent, Pipeline Rules, Performance Monitor, and Agent Log
---

# Hiring Autopilot Hub

## Location
- Tab: **Autopilot** on `/recruit/jobs/[id]` (replaces separate Rules / Performance / Agent Log tabs)
- Component: `frontend/src/app/recruit/jobs/[id]/HiringAutopilotHub.tsx`

## Hiring modes
| Mode | Meaning |
|------|---------|
| Manual | Agent off; recruiter moves candidates |
| Assisted | Agent off; Pipeline Rules still run after scoring |
| Autopilot | Agent on + rules; triage on apply then rules |

## Setup wizard
Shown when agent is off, no enabled rules, and no agent log history.
Enables agent (75/40 thresholds) and optionally creates suggested rules.

## Deep links (back-compat)
- `?tab=rules` → Autopilot → Rules section
- `?tab=performance` → Autopilot → Job Health
- `?tab=agent-log` → Autopilot → Activity Log
- `?tab=autopilot&section=agent|rules|health|log|overview`

## Header Agent toggle
Gear icon opens Autopilot → Triage Agent section (not the old popover).
