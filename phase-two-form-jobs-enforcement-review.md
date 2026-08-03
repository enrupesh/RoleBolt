# Phase 2 — Form Jobs Enforcement Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 2  
**Result:** Phase 2 review gate **PASSED**

---

## 1. Scope

Protect recruiter Form Job routes **and** public applicant intake. Highest-risk bypass surface: unauthenticated public submit must never create responses without a successful creator-side `form_response_intake` reservation (Pattern C).

Billing owner is always `form.uid` — never the applicant, and Form Jobs have no collaborator model today (`getCollaborationAccess` is Standard-Job-only).

---

## 2. Inventory coverage

| Route / action | Pattern | Operation / counter | Status |
|---|---|---|---|
| `POST /recruit/forms` create | A | `active_forms`, `stored_forms` | ✅ |
| `PATCH /recruit/forms/:id` reopen → active | A | `active_forms` | ✅ |
| Public `POST .../submit` | **C** | `form_response_intake` → `form_responses` (+ `stored_responses`) | ✅ |
| Background response scoring | B / D | `form_response_score` | ✅ |
| Retry score | B | `form_response_score` | ✅ |
| Hiring summary refresh | B | `form_hiring_summary` | ✅ |
| Form Copilot chat / stream / form-insights | B | `copilot_turn_form` (stream reserves **before** SSE) | ✅ |
| Assessment send | A + B | feature `assessments`, `active_assessments`, `assessment_generate_form`, `assessment_send_form` | ✅ |
| Assessment score (public submit worker + retry) | B | `assessment_score_form` | ✅ |
| Pipeline rules create / enable | A | `pipeline_rules` | ✅ |
| Pipeline rule execution | B | `pipeline_rule_execution_form` (skip rule on block) | ✅ |
| Agent automated emails | B | `automated_email_form` (skip on block) | ✅ |
| Offer / custom send-email | B | `offer_letter_form` / `automated_email_form` | ✅ |
| Reject-email draft | B | `reject_email_draft_form` | ✅ |
| Interview questions | B | `interview_questions_form` | ✅ |
| Export CSV/JSON | B | `export_form` | ✅ |
| Team seats | A | `recruiter_seats` | ✅ N/A — no Form Jobs collaboration routes |
| Bulk actions | B | `bulk_action_size` via `assertFormBulkActionSize` | ✅ helper contract; no form bulk routes yet |

Reads, deletes, manual stage/notes edits remain unmetered when AI is exhausted.

---

## 3. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Authenticated form route wiring | ✅ | `formEnforcement.ts` + `recruitForms.ts` |
| Public intake Pattern C | ✅ | reserve → create → commit; capacity message for applicants |
| Concurrent submission protection | ✅ | atomic `reserveUsage`; integration test 30→25 |
| Form copilot + scoring | ✅ | `recruitCopilot.ts` form workspace; scoring background path |
| `bulk_action_size` per batch | ✅ | helper exported; no bulk form routes in inventory |
| Tests | ✅ | `formEnforcement.test.ts` + concurrent intake in usage integration |

---

## 4. Review gate

| Check | Result |
|---|---|
| Concurrent public POST — Free limit 25 | ✅ unit semantics + Mongo integration: 30 parallel `form_response_intake` → exactly 25 reserved; overflow `PLAN_LIMIT_REACHED` |
| Capacity message / no orphans | ✅ Pattern C never creates before reserve; applicant message via `respondFormBillingError` |
| AI exhausted | ✅ scoring/assessment catch billing errors; response kept (`scoringFailed` / assessment failed); manual review remains |
| Collaborator uses owner quota | ✅ N/A for Form Jobs (owner = `form.uid` only); helper `formBillingOwnerUid` documents the contract |
| Audit matrix every form row ✅ | ✅ see §2 |

---

## 5. Key implementation notes

1. **Pattern C** — `runFormBillingOperation({ operation: "form_response_intake" })` wraps create; nested `assertFormResourceLimit(stored_responses)`.
2. **AI exhaustion does not delete responses** — background score / assessment score log billing blocks and leave records for manual review.
3. **Copilot stream** — Form workspace reserves `copilot_turn_form` before SSE headers so limit errors remain JSON.
4. **Pipeline execution** — each firing is metered; billing block skips that rule without failing the request path.
5. **Catalog fix** — `pipeline_rule_execution_form` no longer increments `automated_emails` (stage moves are not emails).
6. **Frontend** — `FormErrorNotice` on create/export/rules; public form prefers `message` for capacity copy; Form Copilot surfaces plan-limit JSON.

---

## 6. Verdict

**Phase 2 is complete.** Proceed to **Phase 3 — Standard Jobs enforcement**.
