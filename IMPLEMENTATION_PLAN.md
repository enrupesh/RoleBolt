# 🚀 RoleBolt — Master Implementation Plan
## Build with Gemini XPRIZE Hackathon | Deadline: Aug 17, 2026
## Last Updated: July 28, 2026

---

## 📊 OVERALL PROGRESS TRACKER

| # | Feature | Category | Status | Priority |
|---|---------|----------|--------|----------|
| 1.1 | AI Agent Mode Toggle | Job Creator | ✅ DONE | P1 |
| 1.2 | AI Pipeline Manager (Rules) | Job Creator | ✅ DONE | P1 |
| 1.3 | AI Daily Recruiter Briefing | Job Creator | ✅ DONE | P1 |
| 1.4 | AI Job Performance Monitor | Job Creator | ⏳ Pending | P1 |
| 1.5 | AI Job Description Generator (enhance) | Job Creator | ⏳ Pending | P2 |
| 1.6 | Salary Benchmarking | Job Creator | ⏳ Pending | P2 |
| 2.1 | Job Seeker Account System | Job Seeker | ⏳ Pending | P1 |
| 2.2 | AI Resume Builder | Job Seeker | ⏳ Pending | P1 |
| 2.3 | AI Job Match Score | Job Seeker | ⏳ Pending | P1 |
| 2.4 | AI Cover Letter Generator | Job Seeker | ⏳ Pending | P2 |
| 2.5 | AI Interview Prep | Job Seeker | ⏳ Pending | P1 |
| 2.6 | AI Profile Optimizer | Job Seeker | ⏳ Pending | P2 |
| 2.7 | Smart Job Alerts (AI-ranked) | Job Seeker | ⏳ Pending | P2 |
| 3.1 | Stripe Subscription + Pricing | Monetization | ⏳ Pending | P1 |
| 4.1 | Gemini API Direct Verification | Compliance | ⏳ Pending | P1 |
| 4.2 | Google Cloud Run Deployment | Compliance | ⏳ Pending | P1 |
| 5.1 | Demo Video | Submission | ⏳ Pending | P1 |
| 5.2 | Landing Page Live Stats | Submission | ⏳ Pending | P2 |
| 5.3 | Devpost Submission | Submission | ⏳ Pending | P1 |

---

## 📁 CODEBASE — Full Context (Read Before Making Any Change)

### Tech Stack
- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Framer Motion
  - Dev server: port 5000
  - Frontend URL (prod): https://www.rolebolt.tech/
- **Backend:** Express.js, TypeScript, MongoDB (Mongoose), Resend (email)
  - Dev server: port 8080
  - Backend URL (prod): https://back-mp9k.onrender.com/
- **AI:** Google Gemini (primary) → Mesh API (fallback) → NVIDIA NIM Llama 3.1 (last fallback)
- **Auth:** Custom JWT (cookie `rb_token` + localStorage), Firebase for social auth

### Key Files
```
backend/src/
  index.ts                  ← Express app entry, registers all routers
  recruit.ts                ← Main router (2985+ lines) — all job/candidate routes
  recruitForms.ts           ← Custom screening forms router
  recruitCopilot.ts         ← AI Hiring Copilot router
  auth.ts                   ← Auth router (signup, login, social, forgot password)
  mailer.ts                 ← sendEmail() function using Resend
  emailTemplates.ts         ← All HTML email templates
  db.ts                     ← MongoDB connection
  authMiddleware.ts         ← JWT verification middleware
  models/
    RecruitJob.ts           ← Job schema (has agentMode field now ✅)
    RecruitCandidate.ts     ← Candidate schema (all pipeline stages)
    RecruitForm.ts          ← Custom form schema
    RecruitFormResponse.ts  ← Form submission schema
    RecruitJobAlert.ts      ← Job alerts schema
    RecruitSeekerProfile.ts ← Seeker profile schema (exists!)
    RecruitCompanyProfile.ts← Company profile schema
    User.ts                 ← User schema (auth)
    UsageEvent.ts           ← Analytics events
  ai/
    geminiClient.ts         ← Direct Gemini API calls
    meshClient.ts           ← Mesh API (aggregator)
    nvidiaClient.ts         ← NVIDIA NIM fallback

frontend/src/
  app/
    recruit/
      login/page.tsx
      signup/page.tsx
      dashboard/page.tsx          ← Main recruiter dashboard
      jobs/[id]/page.tsx          ← Candidate pipeline (MODIFIED ✅)
      jobs/new/page.tsx           ← 4-step job creation wizard
      analytics/page.tsx          ← Analytics & metrics
      copilot/page.tsx            ← AI Hiring Copilot chat
      talent-pool/page.tsx        ← Cross-job candidate database
      forms/page.tsx
      forms/new/page.tsx
      forms/[id]/page.tsx
      company-profile/page.tsx
      recruiter-profile/page.tsx
      opportunities/page.tsx      ← PUBLIC: Job board for seekers
      opportunities/[id]/page.tsx ← PUBLIC: Job detail
      opportunities/[id]/apply/page.tsx ← PUBLIC: Apply form
  contexts/
    RecruitAuthContext.tsx        ← Auth state (user, sessionToken, profile)
  lib/
    api.ts                        ← apiUrl() helper, readApiJson()
    trackEvent.ts                 ← Analytics events
  components/
    RecruitGuard.tsx              ← Auth protection wrapper
    RecruitHeader.tsx             ← Global nav
```

### Database Models — All Fields

```typescript
// RecruitJob — job.agentMode is NEW ✅
{
  uid, title, niche, companyName, companyType, jobType, department, seniority,
  location, workMode, salaryMin, salaryMax, salaryCurrency,
  experienceMin, experienceMax, educationRequirement, noticePeriod,
  freshersAllowed, verifiedCompany, publicVisibility,
  responsibilities, mustHaveSkills, niceToHaveSkills, nicheDetails,
  openings, applicationDeadline, perks, languageRequirement, timezoneOverlap,
  generatedJD, rubric[{name, weight, description}],
  status: "active"|"paused"|"closed",
  candidateCount,
  reports[{reason, details, reportedAt}],
  // ✅ NEW FIELD:
  agentMode: {
    enabled: Boolean,              // false=Manual, true=AI Agent
    shortlistThreshold: Number,    // default 75 (score% >= this → auto-shortlist)
    rejectThreshold: Number,       // default 40 (score% < this → auto-reject)
    autoEmailShortlist: Boolean,   // default true
    autoEmailReject: Boolean,      // default false
    autoSendAssessment: Boolean,   // default false
  }
}

// RecruitCandidate
{
  jobId, uid, name, email, phone, resumeText,
  totalScore, maxScore, scoreBreakdown[{criterion, score, maxScore, reasoning, confidence, tier}],
  aiSummary, redFlags[], strengths[],
  stage: "applied"|"screened"|"assessed"|"interview"|"offer"|"hired"|"rejected",
  notes, interviewBrief,
  assessmentStatus: "not_sent"|"sent"|"completed",
  assessmentToken, assessmentSentAt, assessmentCompletedAt, assessmentReminderSentAt,
  assessmentQuestions[{id, text}], assessmentAnswers[{questionId, answer, timeTakenSeconds}],
  previousResumeScore, hiringDecision: "strong_yes"|"maybe"|"no",
  assessmentImpact: {strengths, weaknesses, reasoning},
  scoringFailed, source, gender, ageRange,
  inTalentPool, talentPoolNote, stageMovedAt,
  emailLog[{type, to, subject, body, sentAt, status, error}],
  offerLetter, location, currentStatus, educationLevel,
  currentClassYear, availability, coverLetter, linkedinUrl
}

// User
{ email, passwordHash, name, isVerified, githubId, googleId,
  phoneNumber, phoneId, verificationToken, resetToken }
```

### Existing API Routes

```
AUTH (Public):
  POST /auth/signup/login              Email signup/login
  POST /auth/social                    Google/phone social login
  GET  /auth/github/callback           GitHub OAuth
  POST /auth/forgot/reset-password     Password reset
  GET  /auth/me                        (Protected) Get current user

RECRUIT (Protected — requires: Authorization: Bearer <jwt>):
  GET  /recruit/jobs                   List recruiter's jobs
  POST /recruit/jobs                   Create job
  GET  /recruit/jobs/:id               Get job details
  PATCH /recruit/jobs/:id              Update job fields
  DELETE /recruit/jobs/:id             Delete job
  PATCH /recruit/jobs/:id/agent-mode   ✅ NEW: Update AI Agent settings

  GET  /recruit/jobs/:id/candidates              List candidates
  POST /recruit/jobs/:id/candidates              Add candidate (score resume)
  PATCH /recruit/jobs/:id/candidates/:cid        Update candidate (stage, notes, etc.)
  DELETE /recruit/jobs/:id/candidates/:cid       Remove candidate
  POST /recruit/jobs/:id/candidates/:cid/retry-score
  POST /recruit/jobs/:id/candidates/:cid/brief   Generate interview brief
  POST /recruit/jobs/:id/candidates/:cid/assessment/send
  POST /recruit/jobs/:id/candidates/:cid/reject-email
  POST /recruit/jobs/:id/candidates/:cid/send-email
  POST /recruit/jobs/:id/candidates/:cid/reminder
  POST /recruit/jobs/:id/candidates/:cid/offer-letter
  GET  /recruit/jobs/:id/candidates/:cid/seeker-profile
  GET  /recruit/jobs/:id/export                  CSV export

  GET  /recruit/talent-pool            Cross-job candidate pool
  GET  /recruit/analytics              Analytics data
  GET  /recruit/forms                  List forms
  POST /recruit/forms                  Create form
  GET  /recruit/forms/:id              Form detail + responses

  POST /recruit/copilot/chat           AI Copilot (non-streaming)
  POST /recruit/copilot/chat/stream    AI Copilot (SSE streaming)

RECRUIT PUBLIC (No auth needed):
  GET  /recruit-public/jobs            Public job board
  GET  /recruit-public/jobs/:id        Public job detail
  POST /recruit-public/jobs/:id/apply  ✅ MODIFIED: Apply + AI Agent logic
  POST /recruit-public/jobs/:id/match  AI match check
  POST /recruit-public/parse-resume    Parse PDF/DOCX resume
  GET  /recruit-public/assessment/:token  Take assessment
  POST /recruit-public/forms/:slug     Submit custom form
```

### Existing Email Templates (backend/src/emailTemplates.ts)
```typescript
screened(candidateName, jobTitle, companyName)           → shortlisted email
assessment(candidateName, jobTitle, companyName, url)    → assessment link email
assessmentReminder(candidateName, jobTitle, companyName, url)
interview(candidateName, jobTitle, companyName)           → interview invitation
offerEmail(candidateName, jobTitle, companyName, body)   → offer letter email
hired(candidateName, jobTitle, companyName, startDate?)  → welcome email
rejectionEmailHtml(candidateName, jobTitle, companyName, body)
genericEmail(candidateName, subject, body)               → custom email
```

### Existing AI Functions (backend/src/recruit.ts)
```typescript
scoreCandidate({resumeText, jobTitle, rubric})
  → {name, email, totalScore, maxScore, scoreBreakdown, aiSummary, redFlags, strengths, scoringFailed}

generateInterviewBrief({candidateName, jobTitle, resumeText, scoreBreakdown, aiSummary})
  → string (250-350 word brief)

generateAssessmentQuestions({jobTitle, niche, generatedJD})
  → IAssessmentQuestion[] (5 questions)

analyzeAssessmentAnswers({candidateName, jobTitle, resumeText, resumeScorePercent, questions, answers})
  → {combinedScorePercent, hiringDecision, impact}

generateRejectionEmail({candidateName, jobTitle, companyName, stage})
  → string (rejection email body)
```

### AI Client Pattern (use this for all new AI calls)
```typescript
// In backend/src/recruit.ts or a new router file:
import { callGeminiChain } from "./ai/geminiClient";
import { callMeshChatCompletions } from "./ai/meshClient";
import { callNvidia } from "./ai/nvidiaClient";

// Standard pattern with fallback chain:
async function callAI(prompt: string): Promise<string> {
  try {
    const result = await callGeminiChain([{ role: "user", content: prompt }]);
    if (result) return result;
  } catch (e) { console.error("[ai] Gemini failed, trying Mesh:", e); }
  
  try {
    const result = await callMeshChatCompletions([{ role: "user", content: prompt }]);
    if (result) return result;
  } catch (e) { console.error("[ai] Mesh failed, trying NVIDIA:", e); }
  
  const result = await callNvidia([{ role: "user", content: prompt }]);
  return result;
}
```

### Frontend Patterns
```typescript
// API call with auth:
const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/agent-mode`), {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ enabled: true }),
});
const data = await readApiJson(res);

// Auth token from context:
const { sessionToken } = useRecruitAuth();
useEffect(() => { if (sessionToken) setToken(sessionToken); }, [sessionToken]);

// Protected page wrapper:
export default function MyPage() {
  return <RecruitGuard><MyContent /></RecruitGuard>;
}
```

---

---

# ✅ FEATURE 1.1 — AI Agent Mode Toggle
## Status: COMPLETE ✅

### What Was Built
A master toggle on every job's detail page that switches between two modes:

**Manual Mode (OFF):**
- Everything works exactly as before
- Recruiter manually reviews candidates, sends emails, moves pipeline stages
- AI still scores resumes (this always happens)

**AI Agent Mode (ON):**
- When a candidate applies, AI scores their resume
- Score ≥ shortlistThreshold% → AI automatically moves to "screened" stage + sends shortlist email
- Score < rejectThreshold% → AI automatically moves to "rejected" stage + sends rejection email (optional)
- Score in between → stays "applied" for recruiter to manually review
- All this happens non-blocking (setImmediate) after the candidate is saved

### Files Modified
1. `backend/src/models/RecruitJob.ts` — Added `agentMode` sub-schema + interface
2. `backend/src/recruit.ts` — Modified apply route to execute agent logic + added `PATCH /recruit/jobs/:jobId/agent-mode` route
3. `frontend/src/app/recruit/jobs/[id]/page.tsx` — Added `AgentMode` type, `AgentModeToggle` component, `handleAgentModeUpdate` handler, toggle rendered in header

### UI Location
Header of `/recruit/jobs/[id]` page — between "Export CSV" and "Add Candidate" buttons

### Settings Available in Toggle
- Master ON/OFF switch
- Shortlist threshold slider: 50%–95% (default 75%)
- Reject threshold slider: 10%–60% (default 40%)
- Toggle: auto-send shortlist email (default ON)
- Toggle: auto-send rejection email (default OFF)
- Live "Score Zones" preview showing what each range means

---

---

# ⏳ FEATURE 1.2 — AI Pipeline Manager (Auto Stage Rules)
## Status: NOT STARTED

### What It Does
Recruiter creates rules like:
- "If candidate completes assessment with score > 70% → auto-move to Interview"
- "If candidate has been in Screened stage for 7+ days → send them a reminder"
- "If total score > 90% → skip screening, go straight to Interview"

Different from Feature 1.1 (which handles the initial application). This handles **post-application stage movements** based on custom rules the recruiter defines.

### Why It Matters for Hackathon
Shows AI is running the full pipeline, not just the entry point. Judges see "AI executes key decisions" across the entire workflow.

### Backend Changes Needed

**Step 1 — Add `pipelineRules` to RecruitJob model** (`backend/src/models/RecruitJob.ts`):
```typescript
// Add to IRecruitJob interface:
pipelineRules: IPipelineRule[];

// Add new interface:
export interface IPipelineRule {
  id: string;
  condition: "score_above" | "score_below" | "assessment_passed" | "assessment_failed" | "stage_age_days";
  threshold: number;        // score% for score conditions, days for age condition
  fromStage?: string;       // optional: only apply when candidate is in this stage
  action: "move_to_screened" | "move_to_interview" | "move_to_offer" | "move_to_rejected" | "send_assessment" | "send_reminder";
  enabled: boolean;
  triggerCount: number;     // how many times this rule has fired (for stats)
}

// Add to schema:
pipelineRules: {
  type: [{
    id: String,
    condition: String,
    threshold: Number,
    fromStage: String,
    action: String,
    enabled: { type: Boolean, default: true },
    triggerCount: { type: Number, default: 0 },
  }],
  default: []
}
```

**Step 2 — Create `evaluatePipelineRules` function** (add to `backend/src/recruit.ts`):
```typescript
async function evaluatePipelineRules(jobId: string, candidateId: string) {
  const job = await RecruitJob.findById(jobId).lean();
  const candidate = await RecruitCandidate.findById(candidateId);
  if (!job || !candidate || !(job as any).pipelineRules?.length) return;

  const rules: any[] = (job as any).pipelineRules.filter((r: any) => r.enabled);
  const scorePct = candidate.maxScore > 0 ? Math.round((candidate.totalScore / candidate.maxScore) * 100) : 0;
  const dayInStage = candidate.stageMovedAt
    ? (Date.now() - candidate.stageMovedAt.getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  for (const rule of rules) {
    // Skip if fromStage defined and doesn't match
    if (rule.fromStage && candidate.stage !== rule.fromStage) continue;

    let conditionMet = false;
    if (rule.condition === "score_above" && scorePct >= rule.threshold) conditionMet = true;
    if (rule.condition === "score_below" && scorePct < rule.threshold) conditionMet = true;
    if (rule.condition === "assessment_passed" && candidate.assessmentStatus === "completed" && candidate.hiringDecision === "strong_yes") conditionMet = true;
    if (rule.condition === "assessment_failed" && candidate.assessmentStatus === "completed" && candidate.hiringDecision === "no") conditionMet = true;
    if (rule.condition === "stage_age_days" && dayInStage >= rule.threshold) conditionMet = true;

    if (!conditionMet) continue;

    // Execute action
    const stageMap: Record<string, string> = {
      move_to_screened: "screened", move_to_interview: "interview",
      move_to_offer: "offer", move_to_rejected: "rejected",
    };

    if (stageMap[rule.action]) {
      await RecruitCandidate.updateOne({ _id: candidateId }, {
        stage: stageMap[rule.action], stageMovedAt: new Date()
      });
      await RecruitJob.updateOne({ _id: jobId, "pipelineRules.id": rule.id },
        { $inc: { "pipelineRules.$.triggerCount": 1 } }
      );
      console.log(`[pipeline-rule] ${rule.condition} → ${rule.action} fired for candidate ${candidateId}`);
    }

    if (rule.action === "send_assessment" && candidate.assessmentStatus === "not_sent") {
      // Trigger assessment send (same logic as POST /assessment/send)
    }
  }
}
```

**Step 3 — Call `evaluatePipelineRules` at these trigger points:**
- After resume scoring (apply route)
- After assessment completion
- After recruiter manually changes stage (PATCH candidate route)

**Step 4 — Add new routes:**
```
GET  /recruit/jobs/:id/pipeline-rules        → get current rules
POST /recruit/jobs/:id/pipeline-rules        → add a rule
PATCH /recruit/jobs/:id/pipeline-rules/:ruleId → update rule
DELETE /recruit/jobs/:id/pipeline-rules/:ruleId → delete rule
```

### Frontend Changes Needed

**Add "Pipeline Rules" tab or section** in `/recruit/jobs/[id]/page.tsx`:
- New tab: add `"rules"` to existing tab array `["pipeline", "jd", "rubric", "post", "rules"]`
- UI: "Add Rule" button → modal with dropdowns
  - Condition: Score above / Score below / Assessment passed / Assessment failed / Days in stage
  - Threshold: number input
  - From stage: optional dropdown
  - Action: Move to Interview / Move to Rejected / Send Assessment / Send Reminder
- List of active rules with toggle + delete
- Each rule shows "Fired X times" counter

---

---

# ⏳ FEATURE 1.3 — AI Daily Recruiter Briefing
## Status: NOT STARTED

### What It Does
Every morning (8 AM UTC), each recruiter gets a personalized AI-generated email:
- How many new applications overnight
- Candidates awaiting your review
- Today's scheduled interviews
- Jobs needing attention (stale, low applications)
- AI's #1 recommended action for today

Recruiters can also trigger it manually from the dashboard.

### Why It Matters for Hackathon
This is the clearest proof of "AI operates the business" — AI is autonomously communicating, planning, and guiding the recruiter's day without any human trigger.

### Backend Changes Needed

**Step 1 — Install node-cron:**
```bash
cd backend && npm install node-cron @types/node-cron
```

**Step 2 — Create `backend/src/jobs/dailyBriefing.ts`:**
```typescript
import cron from "node-cron";
import { connectMongo } from "../db";
import { User } from "../models/User";
import { RecruitJob } from "../models/RecruitJob";
import { RecruitCandidate } from "../models/RecruitCandidate";
import { sendEmail } from "../mailer";
import { callGeminiChain } from "../ai/geminiClient";
import * as emailTemplates from "../emailTemplates";

async function generateBriefingForUser(userId: string) {
  await connectMongo();
  const user = await User.findById(userId).lean();
  if (!user || !(user as any).isVerified) return;

  const jobs = await RecruitJob.find({ uid: userId.toString(), status: "active" }).lean();
  if (jobs.length === 0) return;

  const jobIds = jobs.map(j => j._id);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [newApps, pendingReview, inInterview] = await Promise.all([
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, createdAt: { $gte: yesterday } }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "applied" }),
    RecruitCandidate.countDocuments({ jobId: { $in: jobIds }, stage: "interview" }),
  ]);

  // Stale jobs: active but < 3 applications in last 14 days
  const staleJobs = [];
  for (const job of jobs) {
    const recentApps = await RecruitCandidate.countDocuments({
      jobId: job._id, createdAt: { $gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) }
    });
    if (recentApps < 3) staleJobs.push((job as any).title);
  }

  const prompt = `You are an AI hiring assistant. Generate a brief, actionable morning briefing for a recruiter.

DATA:
- Recruiter name: ${(user as any).name}
- Active jobs: ${jobs.length} (${jobs.map((j: any) => j.title).join(", ")})
- New applications in last 24h: ${newApps}
- Candidates awaiting review: ${pendingReview}
- Candidates in interview stage: ${inInterview}
- Stale jobs (low applications): ${staleJobs.length > 0 ? staleJobs.join(", ") : "none"}

Write a 3-paragraph briefing:
1. Quick summary of overnight activity
2. Today's top priority action (be specific)
3. One insight or suggestion to improve hiring

Keep it under 200 words. Be conversational, not robotic. No bullet points — flowing paragraphs.`;

  let briefingText = "";
  try {
    briefingText = await callGeminiChain([{ role: "user", content: prompt }]) ?? "";
  } catch {
    briefingText = `Good morning ${(user as any).name}! Here's your hiring summary: You have ${newApps} new applications overnight and ${pendingReview} candidates awaiting your review. ${inInterview > 0 ? `${inInterview} candidate(s) are in the interview stage.` : ""} ${staleJobs.length > 0 ? `Consider refreshing these job listings: ${staleJobs.join(", ")}.` : "Your job listings are performing well."}`;
  }

  const html = dailyBriefingEmailHtml({
    name: (user as any).name,
    briefingText,
    newApps, pendingReview, inInterview,
    staleJobs, activeJobs: jobs.length,
    dashboardUrl: "https://www.rolebolt.tech/recruit/dashboard",
  });

  await sendEmail({
    to: (user as any).email,
    subject: `☀️ Your Daily Hiring Briefing — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}`,
    html, text: briefingText,
  });
}

function dailyBriefingEmailHtml(data: {
  name: string; briefingText: string;
  newApps: number; pendingReview: number; inInterview: number;
  staleJobs: string[]; activeJobs: number; dashboardUrl: string;
}): string {
  // Use the existing shell() pattern from emailTemplates.ts
  // Build HTML with stats cards + briefing text + CTA button to dashboard
  // Return full HTML string
  return `<!-- Full HTML email using existing shell pattern from emailTemplates.ts -->`;
}

export function startDailyBriefingJob() {
  // Every day at 8:00 AM UTC
  cron.schedule("0 8 * * *", async () => {
    console.log("[briefing] Running daily briefing job...");
    try {
      await connectMongo();
      const users = await User.find({ isVerified: true }).lean();
      for (const user of users) {
        try { await generateBriefingForUser(user._id.toString()); }
        catch (e) { console.error("[briefing] Failed for user:", (user as any).email, e); }
      }
      console.log(`[briefing] Sent briefings to ${users.length} users`);
    } catch (e) { console.error("[briefing] Cron job failed:", e); }
  }, { timezone: "UTC" });
}

// Export for manual trigger
export { generateBriefingForUser };
```

**Step 3 — Register cron in `backend/src/index.ts`:**
```typescript
import { startDailyBriefingJob } from "./jobs/dailyBriefing";
// At the bottom of index.ts, after routes are registered:
if (process.env.CRON_ENABLED === "true") {
  startDailyBriefingJob();
  console.log("[cron] Daily briefing job scheduled");
}
```

**Step 4 — Add new email template** to `backend/src/emailTemplates.ts`:
Function: `dailyBriefing(name, briefingText, stats, dashboardUrl)`
- Clean design with stats row (4 stat cards): New Apps, Pending Review, Interviews, Active Jobs
- Main briefing text paragraph
- "Open Dashboard →" CTA button
- "Stale jobs" warning section if applicable

**Step 5 — Add manual trigger route** in `backend/src/recruit.ts`:
```typescript
recruitRouter.post("/briefing/send-now", async (req, res) => {
  const uid = getUid(req);
  try {
    const { generateBriefingForUser } = await import("./jobs/dailyBriefing");
    await generateBriefingForUser(uid);
    return res.json({ ok: true, message: "Briefing sent to your email." });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});
```
**Add env variable:** `CRON_ENABLED=true` (in Render deployment settings)

### Frontend Changes Needed

**In `/recruit/dashboard` page** — add a "📬 Daily Briefing" card:
- Shows: "AI sends you a morning briefing every day at 8 AM"
- Button: "Send me today's briefing now" → calls `POST /recruit/briefing/send-now`
- Shows loading state + success toast

---

---

# ⏳ FEATURE 1.4 — AI Job Performance Monitor
## Status: NOT STARTED

### What It Does
AI monitors each active job and automatically alerts recruiter when:
- Job has been open 7+ days with < 5 applications → AI suggests improvements
- Job has been open 14+ days with no progress toward hire
- One-click: Apply AI's suggestion to the job (rewrite JD, suggest salary change, etc.)

### Backend Changes Needed

**Step 1 — Add `performanceAlerts` to RecruitJob model:**
```typescript
performanceAlerts: [{
  type: "low_applications" | "no_hire_14_days" | "high_reject_rate",
  message: String,
  aiSuggestions: [String],   // e.g. ["Add remote option", "Lower experience req"]
  createdAt: Date,
  dismissed: Boolean,
}]
```

**Step 2 — Create alert-checking function** (add to `dailyBriefing.ts` or separate file):
```typescript
async function checkJobPerformanceAlerts(uid: string) {
  const jobs = await RecruitJob.find({ uid, status: "active" }).lean();

  for (const job of jobs) {
    const daysSinceCreated = (Date.now() - (job as any).createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const applicationCount = await RecruitCandidate.countDocuments({ jobId: job._id });

    if (daysSinceCreated >= 7 && applicationCount < 5) {
      // Use AI to generate improvement suggestions
      const prompt = `Job Title: ${(job as any).title}
Days posted: ${Math.floor(daysSinceCreated)}
Applications received: ${applicationCount}
Current requirements: ${(job as any).mustHaveSkills}
Location: ${(job as any).location}, ${(job as any).workMode}

This job is underperforming. Give exactly 3 specific, actionable suggestions to get more applications.
Return JSON: {"suggestions": ["suggestion1", "suggestion2", "suggestion3"]}`;

      // Call AI → parse suggestions
      // Save to performanceAlerts array on the job
    }
  }
}
```

**Step 3 — New routes:**
```
GET  /recruit/jobs/:id/performance        → get alerts + suggestions
POST /recruit/jobs/:id/performance/dismiss/:alertId → dismiss alert
POST /recruit/jobs/:id/performance/apply  → apply a suggestion (AI rewrites JD)
Body: { suggestion: "rewrite_jd" | "add_remote" | "lower_requirements" }
```

### Frontend Changes Needed

**In `/recruit/jobs/[id]/page.tsx`** — add `"performance"` tab:
- Show "⚠️ X Alerts" badge on tab if alerts exist
- Alert cards: yellow border, shows AI suggestion as clickable chips
- "Apply This Suggestion" button → one-click improvement
- "Dismiss" button per alert

---

---

# ⏳ FEATURE 1.5 — Enhanced AI Job Description Generator
## Status: NOT STARTED

### What It Does
Currently exists but improve it with:
- A/B variant generation (generate 2 versions, recruiter picks)
- SEO keyword injection for job boards
- Salary benchmarking integration (show market range during creation)

### Backend Changes Needed
**Enhance existing `/recruit/jobs` POST handler** — already generates JD, add:
```
POST /recruit/jobs/:id/regenerate-jd
Body: { variant?: "conservative" | "bold" | "seo_optimized" }
Returns: { newJD: string }
```

---

---

# ⏳ FEATURE 2.1 — Job Seeker Account System
## Status: NOT STARTED

### What It Does
Creates a completely separate experience for job seekers (candidates):
- Sign up / log in with dedicated seeker accounts
- Build and save their profile once (name, skills, resume, preferences)
- Apply to any job with one click (no re-uploading)
- Track all applications with real-time status
- Receive AI-powered job recommendations

### Note on Existing Code
`backend/src/models/RecruitSeekerProfile.ts` already exists! Check this file first before creating a new model — it may already have most fields needed.

### Backend Changes Needed

**Step 1 — Check existing `RecruitSeekerProfile` model**, add missing fields if needed:
```typescript
// Ensure these fields exist:
{
  userId: ObjectId (ref User),    // links to existing User model
  headline: String,               // e.g. "Senior React Developer"
  bio: String,
  location: String,
  workMode: String,               // remote/hybrid/onsite/any
  resumeText: String,             // parsed resume text
  resumeFileName: String,
  skills: [String],
  experienceYears: Number,
  education: String,
  desiredSalaryMin: Number,
  desiredSalaryMax: Number,
  desiredRoles: [String],
  openToWork: Boolean,
  profileCompleteness: Number,    // 0-100
}
```

**Step 2 — Add `role` field to User model** (`backend/src/models/User.ts`):
```typescript
role: { type: String, enum: ["recruiter", "seeker", "both"], default: "recruiter" }
```

**Step 3 — Create `backend/src/seeker.ts`** router with routes:
```
POST /seeker/profile              Create/update seeker profile
GET  /seeker/profile              Get own profile
POST /seeker/resume/upload        Upload resume → parse → save to profile
GET  /seeker/applications         All my job applications with status
POST /seeker/jobs/:id/apply       Apply with saved profile (one-click)
POST /seeker/jobs/:id/save        Save/bookmark a job
GET  /seeker/saved-jobs           Get saved jobs
```

**Step 4 — Register router in `backend/src/index.ts`:**
```typescript
import seekerRouter from "./seeker";
app.use("/seeker", authMiddleware, seekerRouter);
```

### Frontend Changes Needed

**New pages to create:**
```
frontend/src/app/seeker/
  layout.tsx                    ← Seeker-specific layout (different from recruiter)
  dashboard/page.tsx            ← Seeker home: saved jobs, applications, AI tips
  profile/page.tsx              ← Edit seeker profile
  applications/page.tsx         ← Track all applications with status timeline
  resume/page.tsx               ← AI Resume Builder (Feature 2.2)
  cover-letter/page.tsx         ← AI Cover Letter Generator (Feature 2.4)
  interview-prep/page.tsx       ← AI Interview Prep (Feature 2.5)
```

**Reuse existing pages for seekers:**
- `/recruit/opportunities` — already public job board, keep as is
- `/recruit/opportunities/[id]` — enhance with Match Score feature (Feature 2.3)

**New context:** `SeekerAuthContext.tsx` (similar to `RecruitAuthContext.tsx`)
Or simpler: extend existing auth to check `user.role`

**Create `SeekerGuard` component** (similar to `RecruitGuard`):
```typescript
// Redirect to seeker login if not authenticated as seeker
```

---

---

# ⏳ FEATURE 2.2 — AI Resume Builder
## Status: NOT STARTED

### What It Does
Two modes:
1. **Build from scratch**: AI asks 8 questions in a chat-style UI → builds complete ATS-optimized resume
2. **Improve existing**: Upload resume + paste target job description → AI improves it

Output: Preview + Download PDF

### Backend Changes Needed

**Add to `backend/src/seeker.ts`:**

```typescript
// Mode 1: Build from scratch
POST /seeker/resume/build
Body: {
  answers: [{question: string, answer: string}],
  targetRole?: string
}
Response: {
  resume: {
    contactInfo: {name, email, phone, location, linkedin},
    summary: string,
    experience: [{title, company, duration, bullets: []}],
    education: [{degree, school, year}],
    skills: {technical: [], soft: []},
    atsKeywords: [],
    atsScore: number
  },
  fullText: string
}

Prompt for Gemini:
"You are a professional resume writer. Based on these Q&A answers, create a complete ATS-optimized resume.
Target Role: {targetRole}
Q&A: {answers}
Return JSON: {contactInfo:{name,email,phone,location}, summary:'...', experience:[{title,company,duration,bullets:[]}], education:[{degree,school,year}], skills:{technical:[],soft:[]}, atsKeywords:[], atsScore:85}"

// Mode 2: Improve existing
POST /seeker/resume/improve
Body: { resumeText: string, targetJobDescription: string }
Response: { improvedResume: string, changes: string[], atsScore: number }

// Generate PDF
POST /seeker/resume/pdf
Body: { resumeJson: object }
Response: PDF buffer
// Use: npm install puppeteer (in backend)
// Or simpler: return HTML and let frontend handle print-to-PDF
```

### Frontend Changes Needed

**New page: `frontend/src/app/seeker/resume/page.tsx`**

3-step wizard:
1. Choose mode (Build from scratch / Improve existing)
2. Build: Chat-style Q&A (AI asks, user answers)
   - Questions: Name & target role → Experience years → Last job → Top achievements → Key skills → Education → Job preferences
   - Progress bar
   Improve: Upload resume + paste JD
3. Preview → Download / Save to profile

AI questions to ask in order:
```
1. "What's your full name and what job role are you targeting?"
2. "How many years of professional experience do you have?"
3. "What's your most recent job title and company?"
4. "Describe your top 2-3 achievements in your last role. Include numbers if possible."
5. "What are your top 5-7 technical skills?"
6. "Tell me about your education (degree, school, year)."
7. "What type of work arrangement are you looking for? (Remote/Hybrid/Onsite)"
8. "Any certifications, side projects, or open source work to highlight?"
```

**PDF Download:**
- Use `window.print()` with print-specific CSS (hidden nav, white background)
- Or generate server-side with puppeteer and download as blob

---

---

# ⏳ FEATURE 2.3 — AI Job Match Score
## Status: NOT STARTED

### What It Does
Before a seeker applies to a job, they see:
- Their match percentage (0-100%)
- Which skills they have vs. what's needed
- Specific tips to improve their match
- Color-coded: Green (Strong) / Yellow (Good) / Orange (Moderate) / Red (Weak)

### Note
`POST /recruit-public/jobs/:id/match` route already exists! Enhance it.

### Backend Changes Needed

**Enhance existing route** in `backend/src/recruit.ts`:
```typescript
// Current body: probably minimal
// New body:
{ resumeText: string, seekerProfileId?: string }

// Enhanced response:
{
  matchScore: 87,
  matchLabel: "Strong Match",
  matchColor: "#22c55e",
  matchingSkills: ["React", "TypeScript", "Node.js"],
  missingSkills: ["AWS", "Docker"],
  strengthAreas: ["Frontend development"],
  gapAreas: ["Cloud infrastructure"],
  recommendation: "Strong candidate. Highlight React experience in cover letter.",
  improveTip: "Adding AWS basics could increase your match to 94%"
}

// Prompt for Gemini:
"Compare this resume against this job's requirements.
Job: {title}, Required skills: {mustHaveSkills}
Resume: {resumeText}
Return JSON: {matchScore:87, matchLabel:'Strong Match', matchingSkills:[], missingSkills:[], strengthAreas:[], gapAreas:[], recommendation:'...', improveTip:'...'}"
```

### Frontend Changes Needed

**Enhance `/recruit/opportunities/[id]/page.tsx`** (public job page):
- Add "🎯 Check Your Match" section above Apply button
- Text area: "Paste your resume to see how well you match"
- "Check Match" button
- Animated result: circular progress meter, color-coded
- Skills grid: ✅ matches, ❌ gaps
- AI recommendation text
- "Apply Now" CTA that stays prominent

---

---

# ⏳ FEATURE 2.4 — AI Cover Letter Generator
## Status: NOT STARTED

### What It Does
Seeker pastes/selects a job, AI generates a personalized cover letter in their voice. 3 tone options.

### Backend Changes Needed

**Add to `backend/src/seeker.ts`:**
```typescript
POST /seeker/cover-letter/generate
Body: {
  jobId?: string,
  jobDescription?: string,
  resumeText: string,
  tone?: "professional" | "enthusiastic" | "concise"
}
Response: { coverLetter: string, wordCount: number }

Prompt for Gemini:
"Write a compelling cover letter for this job application.
JOB: {jobDescription}
CANDIDATE RESUME: {resumeText}
TONE: {tone}
Rules: 3 paragraphs (hook + fit + CTA), under 300 words, reference specific skills from JD,
sound human not robotic, never start with 'I am writing to express'.
Return ONLY the cover letter text."
```

### Frontend Changes Needed

**New page: `frontend/src/app/seeker/cover-letter/page.tsx`**
- Job description input (textarea or select from saved jobs)
- Resume text (auto-filled from profile)
- Tone selector: 3 buttons (Professional / Enthusiastic / Concise)
- Generate button → loading → preview
- Copy to clipboard / Download as .txt

---

---

# ⏳ FEATURE 2.5 — AI Interview Prep
## Status: NOT STARTED

### What It Does
AI conducts a mock interview based on the target job. Seeker answers questions, AI gives real-time feedback on each answer with score + improvements.

### Backend Changes Needed

**Add to `backend/src/seeker.ts`:**
```typescript
// Generate questions
POST /seeker/interview-prep/questions
Body: { jobDescription: string, difficulty?: "entry" | "mid" | "senior" }
Response: {
  questions: [{
    id: string,
    question: string,
    category: "behavioral" | "technical" | "situational" | "culture",
    tips: string   // what a good answer includes
  }]
}

// Evaluate a single answer
POST /seeker/interview-prep/evaluate
Body: { question: string, answer: string, jobContext: string }
Response: {
  score: 85,
  grade: "B+",
  strengths: ["Used STAR format", "Specific example"],
  improvements: ["Add quantifiable outcome", "Mention team impact"],
  betterAnswer: "Here's how you could improve: ...",
  followUpQuestions: ["Can you quantify the impact?"]
}

Prompt for evaluate:
"You are an interview coach. Evaluate this answer.
Question: {question}
Answer: {answer}
Job Context: {jobContext}
Return JSON: {score:85, grade:'B+', strengths:[], improvements:[], betterAnswer:'...', followUpQuestions:[]}"
```

### Frontend Changes Needed

**New page: `frontend/src/app/seeker/interview-prep/page.tsx`**

4 screens:
1. **Setup**: Enter job description, choose difficulty → "Start Interview"
2. **Question**: Show question prominently, timer (optional), text answer area
3. **Feedback**: Score badge, strengths ✅, improvements 📈, "Better Answer" collapsible, "Next →"
4. **Summary**: Overall score, weakest categories, "Download Report" / "Practice Again"

---

---

# ⏳ FEATURE 2.6 — AI Profile Optimizer
## Status: NOT STARTED

### What It Does
AI analyzes seeker's profile and gives specific, ranked improvements with estimated impact ("Add AWS → +23% more matches").

### Backend Changes Needed

**Add to `backend/src/seeker.ts`:**
```typescript
POST /seeker/profile/optimize
Body: { resumeText: string, targetRole: string, currentSkills: string[] }
Response: {
  profileScore: 72,
  grade: "B",
  improvements: [{
    priority: "high" | "medium" | "low",
    action: "Add TypeScript to skills",
    impact: "+23% more matches",
    howTo: "Brief instruction"
  }],
  inDemandSkills: ["Docker", "AWS", "TypeScript"],
  missingFromProfile: ["AWS", "Docker"],
  salaryInsight: "Developers with your profile earn $85K-$110K"
}
```

### Frontend Changes Needed

**In `/seeker/profile/page.tsx`** — add "🔍 AI Profile Audit" section:
- "Analyze My Profile" button
- Loading: "AI analyzing your profile against thousands of job listings..."
- Score circle (72/100, Grade B)
- Priority improvements as cards (High/Medium/Low badges)
- "Apply This" quick action buttons where possible
- In-demand skills chip list

---

---

# ⏳ FEATURE 2.7 — Smart Job Alerts (AI-Ranked)
## Status: NOT STARTED

### What It Does
Job seekers subscribe to alerts. AI scores each new job against their profile before sending — only sends high-match alerts with match percentage.

### Backend Changes Needed

**Check existing `RecruitJobAlert` model** — it may already exist. Enhance it with:
```typescript
{
  seekerUserId?: ObjectId,    // if authenticated
  email: String,              // required
  keywords: [String],
  location: String,
  workMode: String,
  salaryMin: Number,
  resumeText: String,         // for AI matching
  frequency: "daily" | "weekly" | "instant",
  active: Boolean,
  lastSentAt: Date
}
```

**In `dailyBriefing.ts` cron job** — add job alert processing:
```typescript
async function sendJobAlerts() {
  const alerts = await RecruitJobAlert.find({ active: true });
  const newJobs = await RecruitJob.find({
    status: "active",
    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  }).lean();

  for (const alert of alerts) {
    if (!newJobs.length) continue;

    // Quick keyword filter
    const matching = newJobs.filter(job =>
      alert.keywords.some((kw: string) =>
        (job as any).title?.toLowerCase().includes(kw.toLowerCase()) ||
        (job as any).mustHaveSkills?.toLowerCase().includes(kw.toLowerCase())
      )
    );
    if (!matching.length) continue;

    // AI quick-score each job vs resume
    const ranked = [];
    for (const job of matching.slice(0, 10)) {
      const score = alert.resumeText
        ? await quickMatchScore(alert.resumeText, (job as any).title, (job as any).mustHaveSkills)
        : 70;
      ranked.push({ job, score });
    }
    ranked.sort((a, b) => b.score - a.score);
    const topJobs = ranked.slice(0, 5);

    // Send email
    const html = jobAlertEmailHtml(topJobs, alert.email);
    await sendEmail({
      to: alert.email,
      subject: `🎯 ${topJobs.length} new jobs match your profile — top match: ${topJobs[0].score}%`,
      html, text: `${topJobs.length} new job matches found. Visit rolebolt.tech to apply.`
    });

    await RecruitJobAlert.updateOne({ _id: alert._id }, { lastSentAt: new Date() });
  }
}
```

**New routes:**
```
POST /recruit-public/job-alerts     Subscribe (no auth, just email)
POST /seeker/alerts                 Create alert (authenticated)
GET  /seeker/alerts                 Get my alerts
DELETE /seeker/alerts/:id           Delete alert
```

### Frontend Changes Needed

**In `/recruit/opportunities/page.tsx`** (public job board) — add "🔔 Get Job Alerts" section:
- Email input
- Keyword input (e.g. "React, Remote, Frontend")
- Subscribe button

**In `/seeker/dashboard/page.tsx`** — Managed alerts with full controls

---

---

# ⏳ FEATURE 3.1 — Stripe Subscription System
## Status: NOT STARTED

### Why Critical
Judges require REAL REVENUE. Without paying customers, "Business Viability" criterion score = 0. This must be done before the deadline.

### Pricing Plans

| Plan | Monthly Price | Job Creator Features | Seeker Features |
|------|-------------|---------------------|-----------------|
| **Free** | $0 | 2 active jobs, 10 candidates/job, basic scoring | Browse jobs only |
| **Pro** | $49/month | Unlimited jobs, AI Agent Mode, Daily Briefing, Pipeline Rules | — |
| **Agency** | $149/month | Everything in Pro + 5 team seats + priority AI | — |
| **Seeker Pro** | $9/month | — | AI Resume Builder, Interview Prep, Cover Letters, Profile Optimizer |

### Backend Changes Needed

**Step 1 — Install Stripe:**
```bash
cd backend && npm install stripe
```

**Step 2 — Add env variables needed:**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_AGENCY_PRICE_ID=price_...
STRIPE_SEEKER_PRICE_ID=price_...
```

**Step 3 — Create `backend/src/models/Subscription.ts`:**
```typescript
{
  userId: ObjectId (ref User),
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  plan: "free" | "pro" | "agency" | "seeker_pro",
  status: "active" | "canceled" | "past_due" | "trialing",
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: Boolean
}
```

**Step 4 — Create `backend/src/billing.ts`** router:
```typescript
POST /billing/create-checkout     Body: {plan} → returns {url} (Stripe checkout URL)
POST /billing/create-portal       → returns {url} (Stripe customer portal URL)
GET  /billing/subscription        → returns current subscription details
POST /billing/webhook             → handles Stripe webhook events
  Events to handle:
  - checkout.session.completed → create Subscription record
  - customer.subscription.updated → update status/plan
  - customer.subscription.deleted → downgrade to free
```

**Step 5 — Create plan enforcement middleware:**
```typescript
// backend/src/middleware/planCheck.ts
export function requirePlan(minPlan: "free" | "pro" | "agency") {
  return async (req: any, res: any, next: any) => {
    const sub = await Subscription.findOne({ userId: req.user._id });
    const plan = sub?.status === "active" ? sub.plan : "free";
    const order = ["free", "pro", "agency"];
    if (order.indexOf(plan) >= order.indexOf(minPlan)) return next();
    return res.status(403).json({ error: "upgrade_required", requiredPlan: minPlan });
  };
}
```

**Step 6 — Apply plan limits to agent routes:**
```typescript
// In recruit.ts:
recruitRouter.patch("/jobs/:id/agent-mode", authMiddleware, requirePlan("pro"), ...)
recruitRouter.post("/briefing/send-now", authMiddleware, requirePlan("pro"), ...)
recruitRouter.post("/jobs/:id/pipeline-rules", authMiddleware, requirePlan("pro"), ...)

// Free plan: limit to 2 active jobs
// In POST /recruit/jobs:
const activeJobCount = await RecruitJob.countDocuments({ uid, status: "active" });
const sub = await Subscription.findOne({ userId: uid });
const plan = sub?.plan ?? "free";
if (plan === "free" && activeJobCount >= 2) {
  return res.status(403).json({ error: "upgrade_required", message: "Free plan limited to 2 active jobs." });
}
```

### Frontend Changes Needed

**New pages:**
```
frontend/src/app/recruit/
  pricing/page.tsx     ← Pricing table (3 columns: Free / Pro / Agency)
  billing/page.tsx     ← Current plan, usage, upgrade/cancel buttons
```

**Pricing page design:**
- 3 columns: Free / Pro (⭐ Most Popular) / Agency
- Feature comparison table
- "Start Free" / "Upgrade to Pro ($49/mo)" / "Get Agency ($149/mo)" CTAs
- Seeker Pro section below main table ($9/mo)

**In recruiter dashboard/navbar:**
- Show current plan badge
- "Upgrade to Pro ↗" button for free users (prominent, hard to miss)

**Upgrade modal** — when free user tries to use a Pro feature:
- Triggered by `403 upgrade_required` response
- Shows what plan unlocks the feature
- "Upgrade Now" button → /recruit/pricing

---

---

# ⏳ FEATURE 4.1 — Gemini API Direct Verification
## Status: NOT STARTED

### What It Does
Ensures the deployed app is clearly using Gemini API directly (not just via aggregator).
Adds a status indicator that judges can verify.

### Backend Changes Needed

**In `backend/src/recruit.ts`** — add response header to AI routes:
```typescript
// Add to any route that calls AI:
res.setHeader("X-AI-Provider", "gemini-direct");
```

**New route** (already may exist at `/recruit/status` or `/health`):
```typescript
GET /status/ai
Response: {
  gemini: { status: "active", model: "gemini-2.0-flash", callCount: X },
  providers: ["gemini-direct", "mesh-fallback", "nvidia-fallback"],
  lastCall: Date
}
```

### Frontend Changes Needed

**In `/recruit/status/page.tsx`** (already exists) — enhance to show:
- "✅ Powered by Google Gemini" with green badge
- AI call statistics
- Uptime / health indicators

---

---

# ⏳ FEATURE 4.2 — Google Cloud Run Deployment
## Status: NOT STARTED

### Why Critical
Hackathon rules require at least one Google Cloud product. Firebase (already used) counts but explicitly deploying to Google Cloud Run is much stronger proof.

### Steps

**Step 1 — Create `backend/Dockerfile`:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx tsc --outDir dist
EXPOSE 8080
CMD ["node", "dist/index.js"]
```

**Step 2 — Create `backend/.dockerignore`:**
```
node_modules
.env
*.log
src  (after build)
```

**Step 3 — Deploy to Cloud Run:**
```bash
gcloud run deploy rolebolt-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,CRON_ENABLED=true"
```

**Step 4 — Update frontend env:**
```
NEXT_PUBLIC_API_URL=https://rolebolt-backend-xxxxx.run.app
```

---

---

# ⏳ FEATURE 5 — Submission Package
## Status: NOT STARTED

### 5.1 — Demo Video (3 minutes max)

**Script outline:**
```
0:00-0:30  Hook: "Hiring takes 40 hours/week. Meet RoleBolt — where AI does it for you."
0:30-1:00  Recruiter: Create a job, enable AI Agent Mode (show the toggle)
1:00-1:30  Apply as candidate → show AI auto-shortlisting → email arrives automatically
1:30-2:00  Seeker side: Match score, Resume builder, Interview prep
2:00-2:30  Daily briefing email + pipeline rules
2:30-3:00  Revenue/users stats + "Built on Google Gemini" logo
```

**Tools:** Loom or OBS for screen recording, Descript for editing

### 5.2 — Landing Page Live Stats

**Add to `/` homepage** (or create one if it doesn't exist):
```
Live counters (fetched from API):
- "X jobs posted"
- "Y candidates processed by AI"
- "Z recruiters using AI Agent Mode"
- "$A revenue generated"
```

New route: `GET /stats/public` → returns aggregated counts (no auth needed)

### 5.3 — Devpost Submission Checklist

- [ ] Register at xprize.devpost.com
- [ ] Category: **"Entrepreneurship & Job Creation"**
- [ ] Project name: RoleBolt — AI-Native Hiring Platform
- [ ] Video uploaded (≤ 3 minutes)
- [ ] Live URL: https://www.rolebolt.tech/
- [ ] GitHub repo: public OR shared with testing@devpost.com and judging@hacker.fund
- [ ] Description mentions: Gemini API, Firebase (Google), Google Cloud Run
- [ ] Revenue screenshot / proof attached
- [ ] User count screenshot attached

---

---

## 🗓️ EXECUTION TIMELINE (21 Days Remaining)

```
Day 1-2   (Jul 29-30):  Feature 1.2 — AI Pipeline Manager (Rules engine)
Day 3     (Jul 31):     Feature 1.3 — AI Daily Briefing (cron + email template)
Day 4     (Aug 1):      Feature 1.4 — AI Job Performance Monitor
Day 5-6   (Aug 2-3):    Feature 2.1 — Job Seeker Account System (model + routes + pages)
Day 7-8   (Aug 4-5):    Feature 2.2 — AI Resume Builder (backend + chat UI)
Day 9     (Aug 6):      Feature 2.3 — AI Job Match Score (enhance existing route + UI)
Day 10    (Aug 7):      Feature 2.4 — AI Cover Letter Generator
Day 11-12 (Aug 8-9):    Feature 2.5 — AI Interview Prep (backend + multi-step UI)
Day 13    (Aug 10):     Feature 2.6 — AI Profile Optimizer
Day 14    (Aug 11):     Feature 2.7 — Smart Job Alerts
Day 15-16 (Aug 12-13):  Feature 3.1 — Stripe Subscription + Pricing Page
Day 17    (Aug 14):     Feature 4.1 — Gemini API verification + status page
Day 18    (Aug 15):     Feature 4.2 — Google Cloud Run deployment
Day 19-20 (Aug 16):     Feature 5.1+5.2 — Demo video + landing page stats
Day 21    (Aug 17):     Feature 5.3 — Devpost SUBMIT ✅
```

---

## ⚡ KEY TECHNICAL RULES (Must Follow for Every Change)

1. **Auth on all protected routes:** `Authorization: Bearer <jwt>` header. Use `authMiddleware` from `backend/src/authMiddleware.ts`.

2. **AI call pattern:** Always use the fallback chain (Gemini → Mesh → NVIDIA). Never call only one provider.

3. **Email:** Always use `sendEmail()` from `backend/src/mailer.ts`. New templates go in `emailTemplates.ts` using the `shell()` wrapper.

4. **Frontend API calls:** Always use `apiUrl()` from `frontend/src/lib/api.ts`. Never hardcode backend URL.

5. **Non-blocking AI:** For any AI call triggered by a user action that doesn't need the result immediately — use `setImmediate()` after responding. Never make users wait for AI.

6. **New backend routes:** Create in new router files (e.g. `backend/src/seeker.ts`, `backend/src/billing.ts`), register in `backend/src/index.ts`.

7. **New frontend pages:** Follow Next.js App Router — `frontend/src/app/[path]/page.tsx`. Use `"use client"` at top for interactive pages.

8. **MongoDB models:** Export from `backend/src/models/`, import in router files. Use `connectMongo()` at start of every route handler.

9. **TypeScript:** No `any` types unless absolutely necessary. Define interfaces for all data shapes.

10. **Test after every feature:** Restart backend workflow, check logs for errors, take screenshot to verify UI.
