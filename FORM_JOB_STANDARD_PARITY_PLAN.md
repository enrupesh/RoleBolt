# Form Job → Standard Job Feature Parity Plan

## 1. Objective

Build Form Jobs into a complete end-to-end hiring workflow with the recruiter-facing capabilities currently available in Standard Jobs, while preserving the defining Form Job behavior:

- Recruiters can create custom screening questions.
- Candidates submit answers through a public form.
- AI evaluates answers and optional resume text.
- Form questions remain the primary evaluation signal.

The target is **feature parity in recruiter experience and hiring lifecycle**, not a forced conversion of `RecruitFormResponse` documents into `RecruitCandidate` documents.

## 2. Instructions for Any Agent Continuing This Work

Before changing code:

1. Read this plan completely.
2. Read `replit.md`, `.agents/memory/MEMORY.md`, and any linked memory topic relevant to the phase.
3. Read the existing implementation in:
   - `backend/src/recruitForms.ts`
   - `backend/src/models/RecruitForm.ts`
   - `backend/src/models/RecruitFormResponse.ts`
   - `frontend/src/app/recruit/forms/[id]/page.tsx`
   - The matching Standard Job implementation in `backend/src/recruit.ts` and `frontend/src/app/recruit/jobs/[id]/`.
4. Do not copy Standard Job routes blindly. Form routes remain under `/recruit/forms` and public Form routes remain under `/recruit-public/forms`.
5. Preserve existing auth and ownership checks. All recruiter reads and writes must remain scoped to the form owner's `uid` or an approved collaboration access record.
6. Do not use mock data for a feature that claims to be complete.
7. Complete and verify one phase before starting the next dependent phase.
8. For every backend change, update every affected frontend caller and verify loading, empty, error, refresh, and persisted states.
9. Never treat `scoringFailed: true` with `aiScore: 0` as a genuine low-quality candidate.
10. Keep AI work non-blocking on candidate-facing submission routes. Save the response first and score asynchronously.

## 3. Current Architecture and Reference Implementations

### Form Job

- Backend router: `backend/src/recruitForms.ts`
- Form model: `backend/src/models/RecruitForm.ts`
- Response model: `backend/src/models/RecruitFormResponse.ts`
- Protected routes: `/recruit/forms`
- Public routes: `/recruit-public/forms`
- Recruiter UI: `frontend/src/app/recruit/forms/[id]/page.tsx`
- Form editor: `frontend/src/app/recruit/forms/new/page.tsx`

Already present in Form Jobs:

- Custom questions and public form submissions
- Optional resume upload/text extraction
- AI score, summary, strengths, red flags
- Per-question scores and answer signals
- Retry scoring
- Candidate stage update and private notes
- Email/rejection email flows
- Interview-question generation
- Basic AI Agent mode
- Basic pipeline rules
- Agent log/statistics
- CSV/JSON export

### Standard Job

Use these as behavior references, not as routes to copy:

- Job/candidate models: `backend/src/models/RecruitJob.ts`, `backend/src/models/RecruitCandidate.ts`
- Main recruiter router: `backend/src/recruit.ts`
- Standard detail page: `frontend/src/app/recruit/jobs/[id]/page.tsx`
- Job analysis: `frontend/src/app/recruit/jobs/[id]/JobAnalysisTab.tsx`
- AI hiring summary: `frontend/src/app/recruit/jobs/[id]/AiHiringSummaryTab.tsx`
- Assessment analytics: `frontend/src/app/recruit/jobs/[id]/AssessmentAnalyticsTab.tsx`
- Live assessment progress: `frontend/src/app/recruit/jobs/[id]/LiveAssessmentProgressTab.tsx`
- Collaboration: `frontend/src/app/recruit/jobs/[id]/CollaborationTab.tsx`
- Bulk import: `frontend/src/app/recruit/jobs/[id]/BulkImportModal.tsx`
- Cross-job talent pool: `frontend/src/app/recruit/talent-pool/page.tsx`
- Recruiter Copilot: `backend/src/recruitCopilot.ts`, `frontend/src/app/recruit/copilot/page.tsx`

## 4. Non-Negotiable Product Decisions

### 4.1 Keep Form-specific scoring

The Form Job score must continue to use:

1. Answer quality and answer signals
2. Question-level scores
3. Optional resume analysis
4. Optional assessment score after Phase 10

Do not replace this with Standard Job's resume-only rubric.

### 4.2 Use a Form-specific stage adapter

Form responses currently use:

```text
new → shortlisted → interview → hired → rejected
```

The target lifecycle is:

```text
new → scored → review_zone → shortlisted → assessment → interview → offer → hired
                                                                    ↘ rejected
new / any active stage → withdrawn
```

Existing stage values must remain readable for old documents. If the enum is expanded, add a safe migration/compatibility strategy and update all stage filters, rules, emails, exports, and UI labels together.

### 4.3 Do not weaken ownership

Every new Form endpoint must verify:

- The form belongs to the authenticated recruiter, or
- The recruiter has a valid collaboration access record with the required permission.

Do not query a response by `responseId` alone when an owner/form scope can be included.

### 4.4 Avoid one giant Form page

`frontend/src/app/recruit/forms/[id]/page.tsx` is currently a large surface. Add focused components/tabs as features grow, while preserving the existing route and visual language.

## 5. Target Data Model

Extend the Form domain rather than merging it into Standard Job.

### 5.1 `RecruitForm`

Add or evolve:

- Optional job metadata:
  - `companyName`
  - `companyType`
  - `jobType`
  - `department`
  - `seniority`
  - `location`
  - `workMode`
  - `salaryMin`
  - `salaryMax`
  - `salaryCurrency`
  - `experienceMin`
  - `experienceMax`
  - `educationRequirement`
  - `openings`
  - `applicationDeadline`
  - `perks`
  - `timezone`
  - `publicVisibility`
- Form scoring configuration:
  - question weights/categories
  - optional resume weight
  - optional assessment weight
  - score thresholds
- Expanded AI Agent settings
- Expanded pipeline rules
- Assessment configuration
- Performance alert configuration
- Form analytics counters/cache only if needed for performance; source-of-truth metrics remain derived from responses/events
- Optional collaboration/team settings

All new fields must have safe defaults so old forms continue to load.

### 5.2 `RecruitFormResponse`

Add or evolve:

- `stage` and `stageMovedAt`
- `stageHistory[]`
- `unifiedScore`, `scoreBreakdown[]`, `scoreUpdatedAt`
- `assessmentStatus`, `assessmentToken`, assessment timestamps
- `assessmentQuestions[]`, `assessmentAnswers[]`, `assessmentScore`, `assessmentImpact`
- `hiringDecision`
- `interviewBrief`
- `tags[]`
- `assignedRecruiterUid`
- `duplicateOf`
- `duplicateCheck`
- `talentPool` fields
- offer lifecycle fields and offer history
- recruiter activity timeline
- reminder state

Use embedded fields for response-specific state and a separate model for large/repeated entities where appropriate.

### 5.3 New models when needed

Prefer separate models for:

- `FormAssessment` or form assessment configuration
- `FormResponseActivity`
- `FormCollaboration`
- `FormOfferVersion`

Do not duplicate large answer/resume payloads into analytics documents.

## 6. Phase-by-Phase Implementation Plan

Each phase below is intentionally small. A phase is complete only when its backend, UI, persistence, and verification criteria are complete.

---

## Phase 0 — Baseline, Contracts, and Safety

### Goal

Create a reliable starting point before feature work.

### Work

- Confirm backend and frontend dependencies are installed.
- Start both existing workflows.
- Record current routes and response shapes.
- Confirm current Form creation, public submission, recruiter response list, stage update, email, export, AI Agent, and pipeline-rule flows.
- Identify any pre-existing TypeScript/runtime failures.
- Add/update tests or request scripts for the existing Form flow where practical.

### Done when

- Existing Form Job flow works before parity changes.
- No baseline failure is incorrectly attributed to later phases.
- The API contract for each existing Form route is documented in the phase notes or code comments.

---

## Phase 1 — Form Parity Foundation and Shared Constants

### Goal

Make the Form domain ready for Standard-level features without breaking old data.

### Backend

- Add shared Form stage constants and transition validation.
- Add backward-compatible stage normalization for old responses.
- Add common ownership/access helper for Form endpoints.
- Add a response activity/event helper.
- Add explicit score-state helpers:
  - pending
  - scored
  - scoring failed
  - stale/retryable
- Add indexes needed for `{ formId, uid, stage }`, score, created date, and assessment status.

### Frontend

- Replace duplicated stage labels/colors with a single Form stage map.
- Add safe handling for legacy stages and missing new fields.
- Add a reusable Form detail navigation structure for future tabs.

### Done when

- Existing responses render after reload.
- Old stage values remain usable.
- Every new phase can use the same stage/access/activity helpers.

---

## Phase 2 — Standard Job Metadata for Form Jobs

### Goal

Allow a Form Job to represent a real job, not only a standalone questionnaire.

### Backend

- Extend create/update/detail/public Form contracts with optional job metadata.
- Validate dates, numeric ranges, status, and visibility.
- Keep public responses limited to safe fields.

### Frontend

- Add an optional “Job Details” section to the Form editor.
- Add company, location, work mode, job type, seniority, compensation, experience, openings, deadline, perks, and visibility.
- Keep these fields optional so existing form-only use cases remain simple.
- Show metadata on the recruiter detail page and public Form page.

### Done when

- A recruiter can save metadata, refresh, edit it, and see it publicly.
- Existing forms without metadata continue to work.
- Closed/paused/expired forms cannot receive submissions.

---

## Phase 3 — Weighted Form Rubric and Unified Scoring

### Goal

Give Form Jobs a configurable scoring model comparable to Standard Job rubrics while keeping answer-first evaluation.

### Backend

- Add question weights/categories and optional scoring criteria.
- Update AI scoring to return:
  - overall form score
  - per-question score
  - signal
  - reasoning
  - confidence
  - strengths
  - red flags
  - summary
- Add optional resume contribution and configurable weights.
- Add a unified score calculation helper.
- Version scoring configuration so old scores remain interpretable.
- Preserve retry behavior and `scoringFailed`.

### Frontend

- Add scoring criteria/weight editor.
- Show the score breakdown and scoring confidence.
- Show which questions are high-signal, low-signal, or not useful.
- Show “scoring pending” and “scoring failed” states clearly.

### Done when

- The same response produces a persisted, explainable score after reload.
- A scoring failure is never displayed as a genuine zero-quality score.
- Changing scoring configuration does not corrupt historical results.

---

## Phase 4 — Full Candidate Pipeline

### Goal

Bring Form responses to the Standard Job lifecycle.

### Backend

- Expand stage support with backward-compatible migration.
- Validate legal and manual stage transitions.
- Persist `stageHistory` with actor, source, timestamp, from/to stage, and reason.
- Add stage-age calculations.
- Add stage transition API responses that return the updated response.
- Add optional bulk stage update endpoint.

### Frontend

- Add pipeline view/list/board behavior to the Form detail page.
- Add all target stages and stage filters.
- Show stage history and who/what moved the response.
- Show recommended next action.

### Done when

- Recruiter can move a response through every supported lifecycle stage.
- Refresh preserves the stage and history.
- Invalid transitions are rejected with a visible message.

---

## Phase 5 — Form Analyze Dashboard (Deterministic Analytics)

### Goal

Implement the Standard Job “Analyze” experience for Form Jobs using real aggregated data.

### Backend

Add a protected aggregate endpoint:

```text
GET /recruit/forms/:formId/analysis
```

Return at minimum:

- total responses
- scored/pending/failed counts
- stage funnel and conversion rates
- average/median score
- score distribution
- score by time period
- applications over time
- source distribution and source quality
- agent action counts
- question response/completion counts
- question-level score/signal performance
- stage aging
- duplicate/spam counts when available
- assessment summary when Phase 12 exists
- offer/hire summary when Phase 14 exists

Do aggregation server-side. Do not send all resumes/answers merely to calculate metrics in the browser.

### Frontend

- Add an Analyze tab/section.
- Add loading, empty, partial, error, and stale-data states.
- Add funnel, score distribution, time series, source, and question-signal views.
- Clearly label metrics with insufficient sample sizes.

### Done when

- Analyze works with zero, one, and many responses.
- Metrics match the database response set.
- Failed scores are excluded from quality averages unless explicitly shown as failures.

---

## Phase 6 — AI Hiring Summary and Form Insights

### Goal

Add the Standard Job AI hiring summary with Form-specific reasoning.

### Backend

Add:

```text
GET  /recruit/forms/:formId/ai-summary
POST /recruit/forms/:formId/ai-summary/refresh
```

Generate and persist/version:

- hiring funnel summary
- candidate quality summary
- strongest candidates
- review-zone candidates
- common strengths
- common red flags
- high-signal questions
- low-signal questions
- form improvement suggestions
- recommended recruiter actions
- confidence and generated-at metadata

AI must not invent metrics; provide deterministic aggregate data to the prompt.

### Frontend

- Add an AI Hiring Summary panel.
- Show generated-at and refresh state.
- Link each insight to the relevant response/question/stage.
- Show empty/sparse-data guidance instead of overconfident conclusions.

### Done when

- Summary is based on current saved analytics.
- Refresh persists and displays the new result.
- AI failure leaves the previous valid summary intact and shows an actionable error.

---

## Phase 7 — Advanced AI Agent

### Goal

Upgrade the existing Form Agent from shortlist/reject automation to Standard-level hiring automation.

### Backend

Extend agent settings with:

- review-zone range
- auto interview invitation
- auto assessment
- assessment reminder
- stage-age follow-up
- recruiter notification
- duplicate handling
- manual approval gates
- enabled action types

Add/idempotently improve:

- score decision
- review-zone decision
- stage movement
- email actions
- assessment actions
- reminder actions
- recruiter notifications
- agent action reason/status
- retry-safe execution
- agent stats and logs

Never await agent AI/email work inside candidate submission response handling.

### Frontend

- Expand Agent settings UI.
- Show action counts, failures, skipped actions, and last run.
- Show per-response agent reasoning.
- Add manual “run agent”/retry action only if the backend is idempotent.

### Done when

- A new scored response is acted on once.
- Reprocessing does not send duplicate emails or assessments.
- Failed actions are visible and retryable.
- Manual mode never performs automatic actions.

---

## Phase 8 — Advanced Pipeline Rules

### Goal

Match Standard Job pipeline automation with Form-specific conditions.

### Backend

Support conditions such as:

- score above/below
- answer contains/matches
- specific answer equals
- assessment passed/failed
- stage age
- source equals
- resume present/missing
- no response to email

Support actions such as:

- move to stage
- send email
- send assessment
- send reminder
- assign recruiter
- add tag
- add note
- mark review required
- generate interview brief
- notify recruiter
- create offer draft

Add idempotency, rule execution history, and safe trigger counting.

### Frontend

- Add rule builder with condition/action-specific fields.
- Add enable/disable, edit, delete, and test-preview behavior.
- Show trigger counts and recent executions.

### Done when

- A rule can be created, tested, enabled, fired, disabled, and audited.
- A rule cannot repeatedly perform the same irreversible action.

---

## Phase 9 — Candidate Analyze, Brief, and Interview Workspace

### Goal

Give recruiters a Standard Job-style deep analysis for each Form response.

### Backend

Add or extend response endpoints for:

- complete candidate analysis
- interview brief generation
- interview question generation
- hiring recommendation
- next-step recommendation
- resume/form/assessment consistency checks

Persist cached generated results and versions.

### Frontend

Create a focused response detail view containing:

- overall and unified score
- question-by-question evidence
- resume evidence
- assessment evidence when available
- strengths/red flags
- AI recommendation
- confidence
- interview brief
- tailored questions
- stage/activity/email history
- notes and tags

### Done when

- Recruiter can open a response, analyze it, refresh the page, and see the same persisted result.
- Generated questions and brief are not regenerated unnecessarily.

---

## Phase 10 — Assessment Configuration and Sending

### Goal

Add a real assessment lifecycle for Form Jobs.

### Backend

Create Form assessment configuration/state with:

- assessment title/instructions
- question types
- generated/manual questions
- time limit
- expiry
- pass threshold
- allowed attempts
- randomization if supported
- candidate token
- sent/started/completed/expired status

Add protected routes for recruiter actions and public tokenized routes for candidates.

### Frontend

- Add assessment builder/configuration.
- Add send/resend/cancel actions.
- Show assessment state on candidate cards and detail.
- Show safe public assessment instructions and progress.

### Security

- Token must be unguessable.
- Token must expire.
- Prevent replay after completion or enforce configured attempts.
- Never expose recruiter notes or analytics publicly.

### Done when

- Recruiter can configure and send an assessment.
- Candidate can open it, submit it, and cannot reuse an expired/completed token.

---

## Phase 11 — Assessment AI Scoring and Live Progress

### Goal

Match Standard Job assessment evaluation.

### Backend

- Score submitted assessment answers asynchronously.
- Persist assessment score, breakdown, impact, and failure state.
- Recalculate unified score using configured weights.
- Trigger agent/rules after successful assessment scoring.
- Add live progress endpoint.

### Frontend

- Add assessment result panel to candidate analysis.
- Add live assessment progress tab/panel.
- Show pending, completed, failed, expired, and overdue states.
- Add recruiter retry for failed scoring.

### Done when

- Assessment completion changes the candidate’s persisted evaluation.
- Pipeline/agent actions use the new score exactly once.

---

## Phase 12 — Assessment Analytics and Form Performance Monitoring

### Goal

Add Standard Job assessment analytics and performance monitoring tailored to Forms.

### Backend

Add protected endpoints for:

```text
GET /recruit/forms/:formId/assessment-analytics
GET /recruit/forms/:formId/performance
POST /recruit/forms/:formId/performance/dismiss/:alertId
```

Include:

- sent/started/completed/expired
- completion and pass rates
- average completion time
- question-level assessment performance
- pending/overdue candidates
- assessment-to-interview conversion
- form completion/drop-off rate
- source quality
- low application/high rejection/no-hire alerts
- AI suggestions with explicit evidence

### Frontend

- Add Assessment Analytics panel.
- Add Performance/Alerts panel.
- Add dismiss and refresh behavior.
- Do not show an alert without enough data or a clear reason.

### Done when

- Metrics match persisted assessment and response records.
- Alerts survive refresh and can be dismissed.

---

## Phase 13 — Emails, Reminders, and Recruiter Briefing

### Goal

Complete the communication automation used in Standard Jobs.

### Backend

- Ensure Form templates exist for shortlist, review zone, rejection, interview, assessment, reminder, offer, expiry, and candidate response.
- Persist all send attempts in `emailLog`.
- Add reminder scheduling/state and retry behavior.
- Include Form responses in the daily recruiter briefing.
- Keep send operations non-blocking where they are triggered by candidate-facing actions.

### Frontend

- Show email timeline/status.
- Add manual resend/retry where safe.
- Show pending reminders and delivery failures.

### Done when

- Recruiter can see what was sent, to whom, when, and whether it succeeded.
- Automatic actions do not send duplicate messages.

---

## Phase 14 — Offer Letter and Offer Management

### Goal

Allow a Form candidate to complete the same offer workflow as a Standard candidate.

### Backend

Implement Form-scoped equivalents of:

- AI offer draft
- recruiter edit/save
- approve and send
- PDF download
- offer token
- candidate offer page
- accept/decline
- expiry
- reminders
- version history
- offer activity log

Reuse the established offer conventions where possible, but keep ownership and response lookup Form-scoped.

### Frontend

- Add Offer stage action.
- Add Offer Letter modal with draft/edit/version/settings behavior.
- Auto-open or clearly prompt when a response reaches Offer.
- Add candidate offer status and preview.

### Done when

- Recruiter approval is required before sending.
- Candidate can safely view/respond to the offer.
- Offer history and status survive reload.

---

## Phase 15 — Collaboration and Activity Timeline

### Goal

Give Form Jobs the same team workflow as Standard Jobs.

### Backend

- Reuse collaboration access boundaries and permission names where applicable.
- Add Form-level and response-level collaboration access.
- Add activity records for stage changes, notes, emails, assessments, offers, assignments, and agent actions.
- Enforce permission checks on every existing and new Form mutation.

### Frontend

- Add collaborator management.
- Add permissions UI.
- Add response assignment.
- Add shared activity timeline and notes/comments.

### Done when

- Owner and collaborator see only permitted Forms/responses.
- Forbidden actions fail safely.
- Activity records identify actor and action source.

---

## Phase 16 — Bulk Actions, Import, Export, and Duplicate Detection

### Goal

Match Standard Job recruiter productivity features.

### Backend

Add safe bulk operations:

- bulk stage change
- bulk shortlist/reject
- bulk email
- bulk assessment send
- bulk assign/tag
- bulk export
- archive/delete with confirmation

Add Form-aware import:

- CSV response import
- resume import with question mapping where meaningful
- validation report
- partial failure report

Add duplicate/spam detection:

- email/phone match
- resume fingerprint
- repeated submission
- suspicious speed/patterns
- copied answer signals

### Frontend

- Selection checkboxes and bulk action toolbar.
- Import modal with preview, mapping, validation, and result report.
- Duplicate warning and merge/ignore decision.

### Done when

- Bulk actions are permission-checked and retry-safe.
- Partial failures are reported instead of silently discarded.
- Duplicate detection never deletes data automatically.

---

## Phase 17 — Talent Pool, Tags, and Candidate Reuse

### Goal

Allow strong Form applicants to be reused across hiring work.

### Backend

- Add Form response talent-pool state.
- Add tags, notes, source, and previous-application references.
- Include Form responses in recruiter talent-pool search/filter.
- Add safe copy/link behavior when considering a candidate for another job/form.

### Frontend

- Add “Add to talent pool” and tags.
- Show previous Form/Job applications where permitted.
- Add Form source/type filters to talent-pool UI.

### Done when

- A recruiter can add/remove a Form response from talent pool.
- Search and filters persist across reload.
- Cross-job visibility respects ownership/collaboration boundaries.

---

## Phase 18 — Public Job Discovery and Application Quality

### Goal

Give Form Jobs the Standard Job public application quality without losing the custom form.

### Backend

- Add safe public Form metadata response.
- Add public discovery/listing eligibility if product requires it.
- Track source/referrer/campaign.
- Add deadline/openings/status enforcement.
- Add duplicate submission handling with a clear candidate message.
- Preserve reCAPTCHA/rate limits.
- Add optional save/resume only with secure candidate tokens.

### Frontend

- Improve public Form presentation with job metadata.
- Add progress, clear validation, upload states, and scoring-pending messaging.
- Do not expose AI recruiter reasoning to the candidate.

### Done when

- A candidate can understand the role, submit safely, and receive a clear success/pending state.
- Closed, expired, full, duplicate, rate-limited, and invalid submissions have distinct messages.

---

## Phase 19 — Recruiter Copilot and Cross-Surface Consistency

### Goal

Make the AI Copilot understand and act on Form Jobs with the same honesty as Standard Jobs.

### Backend

- Add Form fields/metrics/responses to Copilot context.
- Update prompt rules so the Copilot knows which Form features are actually enabled.
- Support Form-specific questions:
  - “Which Form candidates should I review?”
  - “Which question is weak?”
  - “Why is the shortlist small?”
  - “Show candidates pending assessment.”
- Add safe links/actions only for implemented Form capabilities.

### Frontend

- Link from Form Analyze and candidate views to Copilot with form context.
- Show source references for Form-derived answers.

### Done when

- Copilot never claims a Form feature exists unless the backend supports it.
- Form metrics and candidate names match the Form detail page.

---

## Phase 20 — Final UX, Accessibility, Reliability, and Verification

### Goal

Make the complete parity surface production-ready.

### Work

- Split oversized Form detail code into focused components if needed.
- Verify responsive layouts on desktop/tablet/mobile.
- Verify keyboard navigation and visible focus states.
- Add accessible labels to controls, dialogs, charts, and tables.
- Add loading, empty, error, retry, and partial-data states everywhere.
- Remove duplicate client-side aggregation and stale response assumptions.
- Confirm all date, number, enum, and optional-field coercion at API boundaries.
- Confirm all mutations update the local view and remain correct after reload.
- Confirm old Form documents deserialize safely.
- Confirm no secrets or tokens appear in logs or client payloads.

## 7. Final Verification Checklist

### 7.1 Automated/static checks

- Backend typecheck/build passes.
- Frontend typecheck/build/lint passes.
- No unused imports or invalid stage enum values.
- No API caller assumes the wrong response envelope.
- No route is missing authentication or ownership checks.
- No new public endpoint returns recruiter-only fields.

### 7.2 Existing Form regression

- Create a Form.
- Edit title, description, questions, metadata, and status.
- Open the public Form.
- Submit valid and invalid responses.
- Submit with and without a resume.
- Verify required questions, reCAPTCHA/rate limits, and duplicate handling.
- Verify pending scoring, successful scoring, scoring failure, and retry.
- Verify response list, detail, notes, stage change, email, interview questions, delete/archive, and export.
- Verify existing AI Agent and pipeline rules still work.

### 7.3 End-to-end parity flow

Run this exact scenario:

1. Create a Form Job with job metadata and weighted questions.
2. Configure AI Agent thresholds and automation.
3. Configure pipeline rules.
4. Submit multiple candidates with different answer quality and sources.
5. Verify asynchronous scoring and score explanations.
6. Verify agent decisions, emails, logs, and no duplicate actions.
7. Open Analyze and compare metrics with known fixture data.
8. Generate and refresh AI Hiring Summary.
9. Open a candidate Analyze view and generate an interview brief.
10. Send an assessment.
11. Complete it as a candidate with valid and invalid/expired tokens.
12. Verify assessment scoring, unified score, pipeline rules, and live progress.
13. Move a candidate to interview and offer.
14. Generate, edit, approve, send, accept/decline, expire, and download the offer.
15. Invite a collaborator and verify allowed/forbidden actions.
16. Add a candidate to the talent pool.
17. Run bulk action, import, export, and duplicate detection flows.
18. Ask Copilot a Form-specific question and verify source accuracy.
19. Reload every screen and verify persisted state.

### 7.4 Data and security verification

- Test with two recruiters and two Forms.
- Confirm no recruiter can read another recruiter’s Form, response, assessment, offer, notes, or analytics.
- Confirm collaborator permissions are enforced on every mutation.
- Confirm expired assessment/offer tokens cannot be replayed.
- Confirm candidate-facing routes never reveal recruiter notes, agent reasoning, or private analytics.
- Confirm AI/provider failures do not lose saved submissions.
- Confirm email failures are logged and retryable.
- Confirm analytics exclude failed scores from quality calculations.

### 7.5 Visual verification

- Capture the Form detail page with:
  - zero responses
  - normal responses
  - scoring failures
  - active agent
  - analytics
  - assessment pending/completed
  - offer state
- Check mobile and desktop layouts.
- Verify charts, tables, dialogs, filters, and empty states are readable and not clipped.

## 8. Recommended Delivery Order

Do not begin with offers or collaboration. The safest order is:

```text
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9
                                      ↓
                         10 → 11 → 12 → 13 → 14
                                      ↓
                              15 → 16 → 17 → 18 → 19 → 20
```

The first useful milestone is Phases 1–7: a Form Job with a complete candidate pipeline, Analyze dashboard, AI summary, and trustworthy AI Agent. Assessment and offer work should start only after the stage, activity, access, and score foundations are stable.

## 9. Definition of Complete

This project is complete only when a recruiter can:

1. Create a Form Job with optional real-job metadata.
2. Receive and score applicants through custom questions and optional resumes.
3. Analyze the entire funnel and understand which questions produce signal.
4. Let the AI Agent triage candidates safely and transparently.
5. Move candidates through the complete hiring pipeline.
6. Generate interview briefs and run assessments.
7. Track assessment and Form performance.
8. Communicate with candidates and send reminders.
9. Create, approve, send, and manage offers.
10. Collaborate with team members.
11. Bulk manage, export, import, de-duplicate, and reuse candidates.
12. Use Copilot with accurate Form context.
13. Reload the app and retain every important state.
14. Complete the entire journey without Standard-only dead ends or misleading UI.
