# Phase 4 — Background Jobs, SSE & Async Paths Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 4  
**Result:** Phase 4 review gate **PASSED**

---

## 1. Scope

Close bypass paths that skip HTTP middleware: cron jobs, `setImmediate` / async workers, and verify SSE paths already metered in Phase 3 still reserve **before** stream headers.

Policy: entitlement is always evaluated at **execution** time. Work queued while Pro and processed after Free/past_due/cancel is blocked unless a reservation was already durably committed.

---

## 2. Inventory coverage

| Path | Operations | Status |
|---|---|---|
| `jobs/pipelineRulesCron.ts` | Owner gate via `canRunMeteredBackgroundWork`; rule firings via `pipeline_rule_execution` | ✅ |
| `jobs/dailyBriefing.ts` | `daily_briefing` via `tryBackgroundBillingOperation` (per user / UTC day key) | ✅ |
| `jobs/offerManagement.ts` | Expiry/warning/reminder emails via `automated_email_standard`; DB mark-expired unmetered | ✅ |
| Public apply / form submit async scoring | `candidate_score` / `form_response_score` at execution | ✅ |
| Agent + pipeline `setImmediate` | `agent_action` / `pipeline_rule_execution` at execution | ✅ |
| Assessment score workers | `assessment_score_*` at execution | ✅ |
| Copilot SSE | Reserve before SSE (Phase 3 + verified) | ✅ |
| Bulk import SSE | Batch + file gates before SSE (Phase 3 + verified) | ✅ |
| Retry-score routes | Stable / request idempotency; intentional retry = new charge; provider retry = same key | ✅ |

### Intentionally unmetered (documented in code)
- Offer accept/decline **recruiter** notification (candidate-triggered transactional)
- Assessment completion-rate dashboard alert (operational, not a campaign)
- Seeker job-alert emails (`sendJobAlerts`)

---

## 3. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Entitlement check at cron iteration start | ✅ | Per job owner / per user / per offer email |
| Reservation before AI/email in background | ✅ | `tryBackgroundBillingOperation` |
| Retry-score idempotency verified | ✅ | Documented + audited |
| Plan-change while queued tested | ✅ | Unit + integration (past_due gate, Free exhaust, idempotent reserve) |

---

## 4. Review gate

| Check | Result |
|---|---|
| Cancel / past_due → cron runs | ✅ `meteredAccessAllowed=false` → skip AI/email; pipeline cron skips job |
| Downgrade while queued | ✅ Execution-time Free limits / access gate; no new AI if exhausted |
| Retry same idempotency key | ✅ Duplicate reserve returns same reservation; committed keys stay committed |
| All async paths from audit | ✅ matrix above |

---

## 5. Key implementation notes

1. **`backgroundEnforcement.ts`** — fail-closed entitlement gate + non-throwing `tryBackgroundBillingOperation` for resilient crons.
2. **Daily briefing** — one charge per user per UTC day; skipped entirely when billing blocked.
3. **Offer cron** — DB expiry still runs; emails await metering so charges complete before process moves on.
4. **SSE** — Copilot + bulk import already reserve before headers (Phase 3); comments mark Phase 4 verification.

---

## 6. Verdict

**Phase 4 is complete.** Proceed to **Phase 5 — Razorpay production lifecycle** only after Phases 1–4 are accepted.
