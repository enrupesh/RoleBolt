# Phase 3 — Standard Jobs Enforcement Review

**Status:** Complete  
**Reviewed:** 2026-08-03  
**Contract:** [`payment.md`](./payment.md), [`paymentgateway.md`](./paymentgateway.md) Phase 3  
**Result:** Phase 3 review gate **PASSED**

---

## 1. Scope

Protect the largest surface — Standard Jobs CRUD, candidates, scoring, bulk import, assessments, pipeline rules, agent execution, Copilot, offers, emails, exports, and collaboration seats.

Billing owner is always the job owner (`job.uid` / `standardBillingOwnerUid`), never a collaborator.

---

## 2. Inventory coverage

| Route / action | Pattern | Operation / counter | Status |
|---|---|---|---|
| Create job | A (+ optional B) | `active_jobs`, `stored_jobs`; `job_generation` (template fallback if AI blocked) | ✅ |
| Reopen → active | A | `active_jobs` | ✅ |
| Add candidate / public apply / talent reuse | A + B | `new_candidate_intake`, `stored_candidates`, `candidate_score` | ✅ |
| Resume scoring / retry-score | B | `candidate_score` (degrades to unscored on AI block) | ✅ |
| Bulk resume import | B | `bulk_import_batch` **before SSE**; per file `bulk_import_item` + intake + score; Free 3 files / 1 import | ✅ |
| Assessments send/generate/score | A + B | feature, `active_assessments`, generate/send/score ops | ✅ |
| Pipeline rules create/enable | A | `pipeline_rules` | ✅ |
| Pipeline rule execution | B | `pipeline_rule_execution` (skip on block) | ✅ |
| Agent mode actions | B | `agent_action` at **execution** (skip on AI exhaust) | ✅ |
| Job analysis / regenerate-JD / performance apply | B | `job_analysis`, `job_generation`, `short_rewrite_standard` | ✅ |
| Copilot chat / stream / insights | B | `copilot_turn_standard` (stream reserves **before** SSE) | ✅ |
| Offers generate / send | B | `offer_letter_standard`, `automated_email_standard` | ✅ |
| Automated / stage / reject emails | B | `automated_email_standard` / `short_rewrite_standard` | ✅ |
| Exports | B | `export_standard` | ✅ |
| Collaboration invites | A | `recruiter_seats` (Free = 1 → 2nd blocked) | ✅ |
| Bulk pipeline UI size | B | `assertStandardBulkActionSize` / plan `bulk_action_size` | ✅ |

---

## 3. Tasks completed

| Task | Status | Notes |
|---|---|---|
| Standard Job CRUD + candidate routes | ✅ | `recruit.ts` + `standardEnforcement.ts` |
| Copilot stream before SSE | ✅ | `recruitCopilot.ts` standard workspace |
| Bulk import per file + batch gate | ✅ | JSON 409 before SSE; batch quantity=1 |
| Agent re-check at execution | ✅ | `dispatchAgentActions` meters `agent_action` |
| Collaboration seat limits | ✅ | `collaboration.ts` invite path |
| Free/Pro/Ultra tests | ✅ | `standardEnforcement.test.ts` |

---

## 4. Review gate

| Check | Result |
|---|---|
| Free 2nd active job blocked | ✅ `active_jobs` limit 1 |
| Bulk import Free 3 files / 1 import | ✅ `bulk_import_files` + `bulk_imports` pre-SSE |
| Copilot stream limit before open | ✅ reserve before SSE headers |
| Agent blocked when AI exhausted | ✅ `agent_action` units; skip + log |
| Collaborator 2nd seat blocked on Free | ✅ `recruiter_seats` |
| Audit matrix every standard row ✅ | ✅ see §2 |

---

## 5. Key implementation notes

1. **Owner billing** — collaborators act on jobs but quota always charges `job.uid`.
2. **AI exhaustion ≠ delete data** — scoring/assessment degrade; candidates remain for manual review.
3. **Job create** — capacity asserted first; if `job_generation` is AI-blocked, job still creates with a template JD/rubric.
4. **Bulk import** — `bulk_import_batch` uses quantity **1** (one import), not file count; file count checked via `assertStandardBulkImportFileCount`.
5. **Frontend** — `StandardErrorNotice` on job create, bulk import, collaboration invite; Copilot surfaces plan-limit JSON.

---

## 6. Verdict

**Phase 3 is complete.** Proceed to **Phase 4 — Background jobs, SSE, and async paths**.
