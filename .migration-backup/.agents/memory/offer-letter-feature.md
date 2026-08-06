---
name: AI Offer Letter Generator
description: Full implementation details for the Offer Letter feature added to the recruit pipeline.
---

## What was built

When a candidate reaches the **Offer** stage a complete offer letter workflow is available.

### Backend model changes (RecruitCandidate.ts)
New fields added to the candidate document:
- `offerStatus`: `"none" | "draft" | "approved" | "sent"` — tracks the lifecycle
- `offerTemplate`: string — which template type was used
- `offerDetails`: object — persists the form inputs (startDate, salary, salaryCurrency, signingBonus, benefits, companyName, hiringManagerName, reportingManager, offerExpiryDate)
- `offerLog`: array of `{ action, note, timestamp }` — audit trail

### Backend routes (recruit.ts)
- `POST /jobs/:jobId/candidates/:candidateId/offer-letter` — generate/regenerate via AI, saves offerDetails + status="draft", logs "draft_generated"
- `PATCH /jobs/:jobId/candidates/:candidateId/offer-letter` — save recruiter edits without regenerating, logs "offer_edited"
- `POST /jobs/:jobId/candidates/:candidateId/offer-letter/send` — approve & send: saves edits, sends branded email, sets status="sent", logs "offer_approved" + "offer_sent", pushes to emailLog
- `GET /jobs/:jobId/candidates/:candidateId/offer-letter/pdf` — generates a professional PDF using `pdfkit` and returns as octet-stream download

**Why:** Recruiter must always approve before sending. AI only creates a draft. The dedicated /send route ensures status tracking and audit logging are always in sync.

### AI generation (generateOfferLetter)
- Accepts `template` parameter: `full_time | internship | contract | remote | custom`
- Each template has tailored prompt instructions (e.g., internship uses "stipend", contract uses "engagement")
- New optional fields: `reportingManager`, `offerExpiryDate`
- `pdfkit` added to backend dependencies

### Frontend (page.tsx)
- `Candidate` type extended with `offerLetter`, `offerStatus`, `offerTemplate`, `offerDetails`, `offerLog`
- `OfferLetterModal` fully rewritten with:
  - Phase 1 (form): template selector (5 options), all fields pre-populated from saved offerDetails
  - Phase 2 (letter): editable textarea, collapsible activity log
  - Footer actions: Edit Details | Regenerate | Save Draft | Download PDF | Approve & Send
  - Status pill on modal header
- `updateStage("offer")` auto-opens the modal so recruiter is immediately prompted
- "Offer Letter" button on card shows offer status pill (Draft/Approved/Sent)
- `onUpdate` callback propagates offer state changes back to the candidate list

**Why:** Auto-open on offer stage is the "automatic" part of the workflow — the modal is there when they need it, but recruiter must always fill in salary/date and approve before anything is sent.
