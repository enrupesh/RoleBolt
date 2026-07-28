# 🚀 RoleBolt — Complete Implementation Plan
## Build with Gemini XPRIZE Hackathon | Deadline: Aug 17, 2026

---

## 📁 Current Codebase — Full Context

### Tech Stack
- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion — runs on port 5000
- **Backend:** Express.js, TypeScript, MongoDB (Mongoose), Resend (email) — runs on port 3001
- **AI:** Google Gemini (primary) → Mesh API (fallback) → NVIDIA NIM Llama 3.1 (last fallback)
- **Auth:** Custom JWT (stored in cookie `rb_token` + localStorage), Firebase for social auth (Google, GitHub)
- **Frontend URL:** https://www.rolebolt.tech/
- **Backend URL:** https://back-mp9k.onrender.com/

### Existing Database Models (MongoDB/Mongoose)

```
User: email, passwordHash, name, isVerified, githubId, googleId, phoneNumber, phoneId, verificationToken, resetToken

RecruitJob: uid, title, niche, companyName, location, workMode, salaryMin, salaryMax, 
            rubric[{name, weight, description}], generatedJD, status(active/paused/closed)

RecruitCandidate: jobId, uid, name, email, resumeText, totalScore, 
                  scoreBreakdown[{criterion, score, reason, confidence, tier}],
                  aiSummary, redFlags, strengths, 
                  stage (applied→shortlisted→interview→offered→hired→rejected),
                  assessmentStatus, assessmentQuestions, assessmentAnswers, emailLog

RecruitForm: uid, title, description, slug, questions[{id, label, type, options}], status

RecruitFormResponse: formId, answers, aiScore, aiSummary, answerSignals[{idx, signal, note}], interviewQuestions

RecruitCopilotConversation: uid, context{level, jobId, candidateId}, messages[{role, content, recommendation, reasoning, sources}]

RecruitImage: uid, contentType, data(Buffer)
```

### Existing API Routes

**Auth (Public):**
- `POST /auth/social` — Google/phone social login
- `GET /auth/github/callback` — GitHub OAuth
- `POST /auth/signup/login` — Email auth
- `POST /auth/forgot/reset-password` — Password reset
- `GET /auth/me` — (Protected) Get current user

**Recruit (Protected — requires JWT Bearer token):**
- `POST /recruit/jobs` — Create job
- `GET /recruit/jobs` — List recruiter's jobs
- `PATCH /recruit/jobs/:id` — Update job
- `POST /recruit/jobs/:id/candidates` — Add candidate + AI resume analysis
- `POST /recruit/jobs/:id/candidates/:candidateId/brief` — Generate interview brief
- `POST /recruit/jobs/:id/candidates/:candidateId/assessment/send` — Send assessment email

**Recruit Public (No auth):**
- `POST /recruit-public/jobs/:id/apply` — Submit resume (public job application)
- `GET /recruit-public/assessment/:token` — Take assessment
- `POST /recruit-public/jobs/:id/match` — AI match check (partially exists)

**Forms:**
- `POST /recruit/forms` — Create custom form
- `POST /recruit-public/forms/:slug` — Submit form response

**Copilot:**
- `POST /recruit/copilot/chat` — Ask AI (non-streaming)
- `POST /recruit/copilot/chat/stream` — Ask AI (SSE streaming)

### Existing Email System
**File:** `backend/src/mailer.ts`
```typescript
sendEmail({ to, subject, html, text?, from? }) → { ok: boolean, error?: string }
```
**Existing Templates in** `backend/src/emailTemplates.ts`:
- `screened` — candidate screened notification
- `assessment` — send assessment link
- `assessmentReminder` — remind candidate about assessment
- `interviewBrief` — interview brief for recruiter
- `rejection` — rejection email
- `general` — generic email
- `verification` — email verification
- `passwordReset` — password reset

### Existing Frontend Pages
```
/recruit/login                    — Login page
/recruit/signup                   — Signup page
/recruit/dashboard                — Main dashboard (or redirect)
/recruit/jobs                     — Job listings for recruiter
/recruit/jobs/new                 — 4-step job creation wizard
/recruit/jobs/[id]                — Candidate pipeline for a job
/recruit/analytics                — Analytics & metrics
/recruit/copilot                  — AI Hiring Copilot chat
/recruit/talent-pool              — Cross-job candidate database
/recruit/forms                    — Custom screening forms
/recruit/forms/new                — Create form
/recruit/forms/[id]               — View form responses
/recruit/company-profile          — Company profile
/recruit/recruiter-profile        — Recruiter profile
/recruit/opportunities            — PUBLIC: Browse all jobs (job seeker side)
/recruit/opportunities/[id]       — PUBLIC: Job detail page
/recruit/opportunities/[id]/apply — PUBLIC: Apply to job
/recruit-public/assessment/:token — PUBLIC: Take assessment
```

### Existing AI Capabilities (backend)
1. **Job Description Generator** — prompt → `{jd, rubric}` JSON
2. **Resume Scorer** — resume + rubric → `{totalScore, scoreBreakdown, aiSummary, redFlags, strengths}`
3. **Assessment Generator** — job description → 5 behavioral questions
4. **Assessment Scorer** — answers + resume → `{combinedScorePercent, hiringDecision}`
5. **Interview Brief Generator** — candidate profile → 250-350 word brief
6. **Copilot** — chat with context (global/job/candidate) → streaming response

---

## 🎯 Features To Implement (In Priority Order)

---

## PHASE 1 — AI-Native Operations (Days 1–6)
### Critical for Hackathon Judging Criterion: "AI executes key decisions"

---

### FEATURE 1.1 — AI Auto-Screening Agent

**What it does:**
When a candidate submits their resume via the public apply form, the AI automatically:
1. Scores the resume (already happens)
2. Makes a shortlist/reject decision based on threshold set by recruiter
3. Sends a personalized email automatically — NO human action needed

**Why this wins:** This is the #1 "AI-Native Operations" proof point for judges.

#### Backend Changes

**File: `backend/src/models/RecruitJob.ts`** — Add these fields to schema:
```typescript
autoScreening: {
  enabled: { type: Boolean, default: false },
  shortlistThreshold: { type: Number, default: 75 },  // score >= this → shortlist + send screened email
  rejectThreshold: { type: Number, default: 40 },      // score < this → auto-reject email
  autoRejectEmail: { type: Boolean, default: false },   // whether to send rejection automatically
  autoShortlistEmail: { type: Boolean, default: true }, // whether to send shortlist email automatically
}
```

**File: `backend/src/recruit.ts`** — In the existing `POST /recruit-public/jobs/:id/apply` handler, AFTER resume scoring is complete, add this logic:

```typescript
// After AI scores the candidate (after setImmediate or wherever scoring happens):
const job = await RecruitJob.findById(jobId);
if (job?.autoScreening?.enabled && candidate.totalScore !== undefined) {
  const score = candidate.totalScore;
  
  if (score >= job.autoScreening.shortlistThreshold) {
    // Auto-shortlist
    candidate.stage = 'shortlisted';
    await candidate.save();
    
    if (job.autoScreening.autoShortlistEmail) {
      const emailHtml = screenedEmailTemplate({
        candidateName: candidate.name,
        jobTitle: job.title,
        companyName: job.companyName,
      });
      await sendEmail({
        to: candidate.email,
        subject: `You've been shortlisted for ${job.title} at ${job.companyName}`,
        html: emailHtml.html,
        text: emailHtml.text,
      });
      candidate.emailLog.push({ type: 'auto_shortlisted', sentAt: new Date() });
      await candidate.save();
    }
  } else if (score < job.autoScreening.rejectThreshold && job.autoScreening.autoRejectEmail) {
    // Auto-reject
    candidate.stage = 'rejected';
    await candidate.save();
    
    const rejectHtml = rejectionEmailTemplate({
      candidateName: candidate.name,
      jobTitle: job.title,
      companyName: job.companyName,
    });
    await sendEmail({
      to: candidate.email,
      subject: `Update on your application for ${job.title}`,
      html: rejectHtml.html,
      text: rejectHtml.text,
    });
    candidate.emailLog.push({ type: 'auto_rejected', sentAt: new Date() });
    await candidate.save();
  }
}
```

**Add new route:**
```
PATCH /recruit/jobs/:id/auto-screening
Body: { enabled, shortlistThreshold, rejectThreshold, autoRejectEmail, autoShortlistEmail }
Auth: Protected
Purpose: Recruiter sets up auto-screening rules
```

#### Frontend Changes

**File: `frontend/src/app/recruit/jobs/[id]/page.tsx`**
- Add a new "⚙️ Auto-Screening" tab or settings panel in the job detail page
- UI: Toggle switch to enable/disable
- Slider for shortlist threshold (default 75)
- Slider for reject threshold (default 40)
- Toggle: "Auto-send shortlist email"
- Toggle: "Auto-send rejection email"
- Show stats: "X candidates auto-shortlisted", "Y auto-rejected this week"

---

### FEATURE 1.2 — AI Pipeline Manager (Auto Stage Movement)

**What it does:**
Recruiter sets rules like "Score > 80 → Move to Interview stage automatically."
AI enforces these rules whenever a new candidate is scored.

**Why this wins:** Shows AI is managing the business pipeline autonomously.

#### Backend Changes

**File: `backend/src/models/RecruitJob.ts`** — Add to schema:
```typescript
pipelineRules: [{
  condition: { type: String },  // e.g. "score_above", "score_below", "assessment_passed"
  threshold: { type: Number },
  action: { type: String },     // e.g. "move_to_interview", "move_to_shortlisted", "send_assessment"
  enabled: { type: Boolean, default: true }
}]
```

**New route:**
```
POST /recruit/jobs/:id/pipeline-rules
Body: { rules: [{condition, threshold, action, enabled}] }
Auth: Protected
```

**Logic:** After any candidate scoring event, loop through `pipelineRules` and execute matching actions automatically.

#### Frontend Changes

**New UI component in job detail page:** "Pipeline Rules" section
- "Add Rule" button → opens modal
- Dropdown: Condition (Score above / Score below / Assessment passed / Assessment failed)
- Number input: Threshold
- Dropdown: Action (Move to Interview / Move to Shortlisted / Send Assessment / Send Rejection)
- List of active rules with enable/disable toggle

---

### FEATURE 1.3 — AI Daily Recruiter Briefing

**What it does:**
Every morning at 8:00 AM, AI generates and emails each recruiter a personalized briefing:
- Today's interviews
- New applications overnight
- Candidates awaiting action
- Jobs that need attention (stale, low applications)
- AI-generated "top priority action" for the day

**Why this wins:** AI is autonomously operating business communications without any human trigger.

#### Backend Changes

**New file: `backend/src/jobs/dailyBriefing.ts`**
```typescript
import cron from 'node-cron';  // npm install node-cron @types/node-cron

export function startDailyBriefingJob() {
  // Run every day at 8:00 AM UTC
  cron.schedule('0 8 * * *', async () => {
    const users = await User.find({ isVerified: true });
    
    for (const user of users) {
      const jobs = await RecruitJob.find({ uid: user._id, status: 'active' });
      if (jobs.length === 0) continue;
      
      // Gather data
      const briefingData = {
        totalActiveJobs: jobs.length,
        newApplications: await RecruitCandidate.countDocuments({
          jobId: { $in: jobs.map(j => j._id) },
          createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
        }),
        pendingReview: await RecruitCandidate.countDocuments({
          jobId: { $in: jobs.map(j => j._id) },
          stage: 'applied'
        }),
        scheduledInterviews: await RecruitCandidate.countDocuments({
          jobId: { $in: jobs.map(j => j._id) },
          stage: 'interview'
        }),
        // Stale jobs: active but 0 applications in 7 days
        staleJobs: [] // compute based on jobs
      };
      
      // Use Gemini to generate personalized briefing text
      const briefingText = await generateAIBriefing(user.name, briefingData, jobs);
      
      // Send email
      await sendEmail({
        to: user.email,
        subject: `☀️ Your Daily Hiring Briefing — ${new Date().toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}`,
        html: dailyBriefingTemplate({ name: user.name, briefingText, briefingData }),
        text: briefingText,
      });
    }
  });
}
```

**In `backend/src/index.ts`:** Import and call `startDailyBriefingJob()` on server start.

**New email template** `dailyBriefing` in `emailTemplates.ts`:
- Clean design with sections: "📊 Yesterday's Summary", "🎯 Today's Priorities", "⚠️ Needs Attention"
- Branded with RoleBolt blue (#0a66c2)

**New route (manual trigger for demo/testing):**
```
POST /recruit/briefing/send-now
Auth: Protected
Purpose: Recruiter can manually trigger their briefing (useful for demo to judges)
```

#### Frontend Changes

**In `/recruit/analytics` page or `/recruit/jobs` page:**
- Add "📬 Briefing Settings" section
- Toggle: Enable/disable daily briefing
- Time preference (currently hardcoded 8 AM, can be a display)
- "Send me today's briefing now" button (calls the manual trigger route)

---

### FEATURE 1.4 — AI Job Performance Monitor

**What it does:**
AI monitors each active job and alerts recruiters when:
- Job has been open 7+ days with fewer than 5 applications
- Job has been open 14+ days with no hire
- AI suggests specific improvements to the job description

**Why this wins:** AI is autonomously monitoring and managing business operations.

#### Backend Changes

**Add to `dailyBriefing.ts` cron job OR create separate cron:**
```typescript
// Check job performance daily
async function checkJobPerformance(uid: string) {
  const jobs = await RecruitJob.find({ uid, status: 'active' });
  const alerts = [];
  
  for (const job of jobs) {
    const daysSinceCreated = (Date.now() - job.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const applicationCount = await RecruitCandidate.countDocuments({ jobId: job._id });
    
    if (daysSinceCreated >= 7 && applicationCount < 5) {
      // Use AI to suggest improvements
      const suggestions = await getAIJobSuggestions(job);
      alerts.push({
        jobId: job._id,
        jobTitle: job.title,
        type: 'low_applications',
        daysSinceCreated: Math.floor(daysSinceCreated),
        applicationCount,
        aiSuggestions: suggestions  // e.g. ["Add remote option", "Expand salary range", "Simplify requirements"]
      });
    }
  }
  return alerts;
}
```

**New model field in RecruitJob:**
```typescript
performanceAlerts: [{
  type: String,        // 'low_applications', 'no_hire_14_days', 'high_drop_off'
  message: String,
  aiSuggestions: [String],
  createdAt: Date,
  dismissed: Boolean
}]
```

**New route:**
```
GET /recruit/jobs/:id/performance
Auth: Protected
Returns: { applicationCount, avgScore, stageBreakdown, alerts, aiSuggestions }
```

**Route:** `POST /recruit/jobs/:id/performance/apply-suggestion`
- Body: `{ suggestion: "add_remote" | "adjust_salary" | "rewrite_jd" }`
- AI applies the suggestion to the job automatically (one-click improvement)

#### Frontend Changes

- In `/recruit/jobs/[id]` page: Add "Performance" tab
- Show alerts with yellow/red badges
- Display AI suggestions as clickable cards: "Apply This Suggestion →"
- One-click: AI rewrites the job description improvement

---

## PHASE 2 — Job Seeker Side (Days 7–14)
### Critical for: Category Impact + User Acquisition

---

### FEATURE 2.1 — Job Seeker Account System

**What it does:**
Create a separate job seeker account system. Job seekers can:
- Sign up / log in (separate from recruiter accounts)
- Have their own profile, saved resume, skills list
- Apply to jobs with their saved profile (no re-uploading)
- Track all their applications

#### Backend Changes

**New model: `backend/src/models/JobSeeker.ts`**
```typescript
const JobSeekerSchema = new Schema({
  // Auth
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Profile
  headline: String,           // e.g. "Senior React Developer"
  bio: String,
  location: String,
  workMode: String,           // remote/hybrid/onsite
  
  // Resume data
  resumeText: String,         // parsed resume text
  resumeFileName: String,
  skills: [String],
  experienceYears: Number,
  education: String,
  
  // Job preferences
  desiredSalaryMin: Number,
  desiredSalaryMax: Number,
  desiredRoles: [String],
  openToWork: { type: Boolean, default: true },
  
  // Meta
  profileCompleteness: Number,  // 0-100, computed
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date,
});
```

**New routes (all under `/seeker/` prefix):**
```
POST /seeker/profile           — Create/update profile
GET  /seeker/profile           — Get own profile
POST /seeker/resume/upload     — Upload resume → AI parses it → saves skills
GET  /seeker/applications      — Get all my applications with status
POST /seeker/jobs/:id/save     — Save/bookmark a job
GET  /seeker/saved-jobs        — Get saved jobs
```

**Middleware:** New `seekerAuth` middleware (same JWT approach, but checks for seeker role or just uses same User model with a `role` field).

**Easiest approach:** Add `role: { type: String, enum: ['recruiter', 'seeker'], default: 'recruiter' }` to existing `User` model. Seekers use same auth system, different dashboard.

#### Frontend Changes

**New pages:**
```
/seeker/login          — Job seeker login (or reuse /recruit/login with role selection)
/seeker/signup         — Job seeker signup
/seeker/dashboard      — Job seeker home (saved jobs, applications, AI recommendations)
/seeker/profile        — Edit seeker profile
/seeker/applications   — Track all applications with status
/seeker/resume         — AI Resume Builder page
```

---

### FEATURE 2.2 — AI Resume Builder

**What it does:**
Job seeker answers a conversational AI interview (10-15 questions), and AI builds a complete, ATS-optimized resume. Downloadable as PDF.

**Why this wins:** High user value, brings job seekers to the platform, demonstrates Gemini usage clearly.

#### Backend Changes

**New route: `POST /seeker/resume/build`**
```typescript
// Body: { answers: [{question: string, answer: string}], targetRole?: string }
// Returns: { resume: { sections: {...}, fullText: string }, atsScore: number }

const prompt = `
You are a professional resume writer. Based on these Q&A answers from a job seeker,
create a complete, ATS-optimized resume in JSON format.

Target Role: ${targetRole || 'General'}

Q&A Data:
${answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

Return JSON with this exact structure:
{
  "contactInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "" },
  "summary": "2-3 sentence professional summary",
  "experience": [{ "title": "", "company": "", "duration": "", "bullets": [""] }],
  "education": [{ "degree": "", "school": "", "year": "" }],
  "skills": { "technical": [], "soft": [] },
  "atsKeywords": [],
  "atsScore": 85
}
`;
```

**New route: `POST /seeker/resume/improve`**
```typescript
// Body: { resumeText: string, targetJobDescription: string }
// Returns: { improvedResume: string, changes: string[], atsScore: number }
// Uses Gemini to improve existing resume for a specific job
```

#### Frontend Changes

**New page: `/seeker/resume`**

Layout:
1. **Step 1 — Choose mode:**
   - "Build from scratch (AI Interview)" 
   - "Improve my existing resume"

2. **Step 2A (Build from scratch) — AI Interview:**
   - Chat-style UI (similar to Copilot)
   - AI asks questions one by one:
     - "What's your name and target job role?"
     - "How many years of experience do you have?"
     - "What's your most recent job title and company?"
     - "Describe your top 3 achievements in your last role"
     - "What are your key technical skills?"
     - "Tell me about your education"
     - "What type of job are you looking for?"
   - Progress bar: "Question 4 of 8"

3. **Step 2B (Improve) — Upload + Target:**
   - Upload existing resume (PDF/DOCX)
   - Paste job description you're targeting
   - AI generates improved version

4. **Step 3 — Preview & Download:**
   - Clean resume preview (HTML/CSS styled as a resume)
   - "Download PDF" button
   - "Copy as Text" button
   - "Save to Profile" button

**PDF Generation:** Use `html-pdf` or `puppeteer` on backend to generate PDF from HTML template.
Install: `npm install puppeteer` in backend.

---

### FEATURE 2.3 — AI Job Match Score

**What it does:**
Before applying to a job, job seeker sees their AI-calculated match percentage. Shows which skills they have vs. what's needed.

**Note:** `/recruit-public/jobs/:id/match` route partially exists. Enhance it.

#### Backend Changes

**Enhance existing route: `POST /recruit-public/jobs/:id/match`**
```typescript
// Current: probably basic
// New body: { resumeText?: string, seekerProfileId?: string }
// Returns enhanced response:
{
  matchScore: 87,                    // 0-100
  matchLabel: "Strong Match",        // Strong/Good/Moderate/Weak
  matchColor: "#22c55e",             // green/yellow/orange/red
  matchingSkills: ["React", "TypeScript", "Node.js"],
  missingSkills: ["AWS", "Docker"],
  strengthAreas: ["Frontend development", "Team leadership"],
  gapAreas: ["Cloud infrastructure"],
  recommendation: "You're a strong candidate. Highlight your React experience in your cover letter. Consider mentioning any cloud platform exposure even if informal.",
  improveTip: "Adding AWS basics to your profile could increase your match to 94%"
}
```

#### Frontend Changes

**In `/recruit/opportunities/[id]` (public job page):**
- Add "Check Your Match" section above the Apply button
- Text input or upload box for resume
- Shows animated match meter (circular progress, color-coded)
- Skills grid: green checkmarks for matches, orange X for gaps
- AI tip at bottom

---

### FEATURE 2.4 — AI Cover Letter Generator

**What it does:**
Job seeker pastes or selects a job, AI generates a personalized, professional cover letter.

#### Backend Changes

**New route: `POST /seeker/cover-letter/generate`**
```typescript
// Body: { jobId?: string, jobDescription?: string, resumeText: string, tone?: 'professional'|'enthusiastic'|'concise' }
// Returns: { coverLetter: string, wordCount: number }

const prompt = `
Write a compelling, personalized cover letter for this job application.

JOB DESCRIPTION:
${jobDescription}

CANDIDATE RESUME:
${resumeText}

TONE: ${tone || 'professional'}

Requirements:
- 3 paragraphs: Opening hook + Why I'm the right fit + Call to action
- Reference specific skills from the job description that match the resume
- Sound human, not robotic
- Under 300 words
- Do NOT use generic phrases like "I am writing to express my interest"

Return ONLY the cover letter text, no JSON wrapper.
`;
```

#### Frontend Changes

**New page: `/seeker/cover-letter`**
- Job description input (textarea OR select from applied jobs)
- Resume text (auto-populated from profile, or paste manually)
- Tone selector: Professional / Enthusiastic / Concise
- "Generate Cover Letter" button
- Preview area with copy button
- "Regenerate" button for a different version

---

### FEATURE 2.5 — AI Interview Prep

**What it does:**
Job seeker selects a job, AI conducts a mock interview using voice/text. AI gives real-time feedback on each answer.

**Why this wins:** Strong Gemini usage, high user engagement, directly helps job seekers.

#### Backend Changes

**New route: `POST /seeker/interview-prep/questions`**
```typescript
// Body: { jobId?: string, jobDescription: string, difficulty?: 'entry'|'mid'|'senior' }
// Returns: { questions: [{id, question, category, tips}] }

// Categories: behavioral, technical, situational, culture-fit
// Uses Gemini to generate 10 role-specific questions
```

**New route: `POST /seeker/interview-prep/evaluate-answer`**
```typescript
// Body: { question: string, answer: string, jobContext: string }
// Returns: { 
//   score: 85,
//   strengths: ["Specific example used", "Clear STAR format"],
//   improvements: ["Add quantifiable outcome", "Mention team collaboration"],
//   betterAnswer: "Here's how you could improve: ...",
//   followUpQuestions: ["Can you elaborate on the outcome?"]
// }
```

#### Frontend Changes

**New page: `/seeker/interview-prep`**

Layout:
1. **Setup:** Enter job description or select from saved jobs, choose difficulty
2. **Interview Mode:**
   - Question displayed prominently
   - Timer (optional — "Interview mode" with countdown)
   - Text area for answer (or future: speech-to-text)
   - "Submit Answer" button
3. **Feedback Panel (appears after answer):**
   - Score badge (A/B/C/D style or 85/100)
   - ✅ What you did well
   - 📈 How to improve
   - 💡 Better answer suggestion (collapsible)
   - "Next Question →" button
4. **End Summary:**
   - Overall interview score
   - Weakest areas to practice
   - "Practice Again" / "Download Report" buttons

---

### FEATURE 2.6 — AI Profile Optimizer

**What it does:**
AI analyzes job seeker's profile and resume, compares against market demand, and gives specific actionable advice to get more interviews.

#### Backend Changes

**New route: `POST /seeker/profile/optimize`**
```typescript
// Body: { resumeText: string, targetRole: string, currentSkills: string[] }
// Returns: {
//   profileScore: 72,
//   grade: "B",
//   improvements: [
//     { priority: "high", action: "Add TypeScript to skills", impact: "+23% more matches" },
//     { priority: "medium", action: "Add a portfolio link", impact: "+12% recruiter clicks" },
//     { priority: "low", action: "Expand your bio to 3+ sentences", impact: "+8% visibility" }
//   ],
//   inDemandSkills: ["Docker", "AWS", "TypeScript"],  // market demand for their role
//   missingFromProfile: ["AWS", "Docker"],
//   salaryInsight: "Developers with your profile earn $85K-$110K in your market"
// }
```

#### Frontend Changes

**In `/seeker/profile` page** — Add "🔍 AI Profile Audit" section:
- "Analyze My Profile" button
- Loading state: "AI is analyzing your profile against 10,000+ job listings..."
- Results in card format:
  - Big score circle (72/100 — Grade B)
  - Priority improvements list with impact badges
  - "In-Demand Skills" you're missing
  - Salary insight
- Each improvement has "Apply This →" quick action

---

### FEATURE 2.7 — Smart Job Alerts

**What it does:**
Job seekers subscribe to job alerts. But unlike basic alerts, AI ranks and scores each alert before sending: "This job is 91% match for you — apply before Friday!"

#### Backend Changes

**New model: `backend/src/models/JobAlert.ts`**
```typescript
const JobAlertSchema = new Schema({
  seekerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  email: { type: String, required: true },
  keywords: [String],           // e.g. ["React", "Frontend", "Remote"]
  location: String,
  workMode: String,             // remote/hybrid/onsite/any
  salaryMin: Number,
  resumeText: String,           // for AI matching
  frequency: { type: String, enum: ['daily', 'weekly', 'instant'], default: 'daily' },
  active: { type: Boolean, default: true },
  lastSentAt: Date,
  createdAt: { type: Date, default: Date.now }
});
```

**In daily cron job (`dailyBriefing.ts`):** Add job alert processing:
```typescript
async function sendJobAlerts() {
  const alerts = await JobAlert.find({ active: true, frequency: 'daily' });
  
  for (const alert of alerts) {
    // Find new jobs matching keywords/location
    const matchingJobs = await RecruitJob.find({
      status: 'active',
      createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) },
      // keyword matching
    });
    
    if (matchingJobs.length === 0) continue;
    
    // AI score each job against seeker's resume
    const rankedJobs = await Promise.all(matchingJobs.map(async (job) => {
      const matchScore = await quickMatchScore(alert.resumeText, job);
      return { job, matchScore };
    }));
    
    // Sort by match score, take top 5
    const topJobs = rankedJobs.sort((a,b) => b.matchScore - a.matchScore).slice(0, 5);
    
    await sendEmail({
      to: alert.email,
      subject: `🎯 ${topJobs.length} new jobs match your profile — top match: ${topJobs[0].matchScore}%`,
      html: jobAlertEmailTemplate(topJobs),
    });
    
    alert.lastSentAt = new Date();
    await alert.save();
  }
}
```

**New routes:**
```
POST /seeker/alerts              — Create job alert
GET  /seeker/alerts              — Get my alerts
DELETE /seeker/alerts/:id        — Delete alert
POST /recruit-public/job-alerts  — Public subscribe (no auth, just email)
```

---

## PHASE 3 — Monetization (Days 14–17)
### Critical for: Business Viability judging criterion

---

### FEATURE 3.1 — Stripe Subscription System

**Why:** Judges require REAL revenue. This is non-negotiable for winning.

#### Plans

| Plan | Price | Limits | Features |
|------|-------|--------|----------|
| **Free** | $0 | 2 active jobs, 10 candidates/job | Basic AI scoring, manual actions |
| **Pro** | $49/month | Unlimited jobs, unlimited candidates | All AI Agents, Auto-screening, Daily briefing, Pipeline rules |
| **Agency** | $149/month | Multi-seat (5 users), unlimited everything | White-label, Priority AI, Analytics export |
| **Seeker Pro** | $9/month | Job seekers | AI Resume Builder, Interview Prep, Cover Letters |

#### Backend Changes

**Install:** `npm install stripe` in backend
**Env vars needed:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**New model: `backend/src/models/Subscription.ts`**
```typescript
const SubscriptionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  stripeCustomerId: String,
  stripeSubscriptionId: String,
  plan: { type: String, enum: ['free', 'pro', 'agency', 'seeker_pro'], default: 'free' },
  status: { type: String, enum: ['active', 'canceled', 'past_due', 'trialing'], default: 'active' },
  currentPeriodEnd: Date,
  cancelAtPeriodEnd: Boolean,
  createdAt: { type: Date, default: Date.now },
});
```

**New file: `backend/src/stripe.ts`**
```typescript
// Routes:
POST /billing/create-checkout    — Create Stripe checkout session → returns { url }
POST /billing/create-portal      — Create customer portal session → returns { url }
GET  /billing/subscription       — Get current subscription status
POST /billing/webhook            — Stripe webhook (handle subscription events)
```

**Add plan enforcement middleware:**
```typescript
// middleware/planCheck.ts
export function requirePlan(minPlan: 'free'|'pro'|'agency') {
  return async (req, res, next) => {
    const sub = await Subscription.findOne({ userId: req.user._id });
    const userPlan = sub?.plan || 'free';
    const planOrder = ['free', 'pro', 'agency'];
    if (planOrder.indexOf(userPlan) >= planOrder.indexOf(minPlan)) {
      next();
    } else {
      res.status(403).json({ error: 'upgrade_required', requiredPlan: minPlan });
    }
  };
}
```

**Apply to AI agent routes:**
```typescript
// Auto-screening: Pro+
router.patch('/jobs/:id/auto-screening', authMiddleware, requirePlan('pro'), ...)

// Daily briefing: Pro+
router.post('/briefing/send-now', authMiddleware, requirePlan('pro'), ...)
```

#### Frontend Changes

**New pages:**
```
/recruit/pricing        — Pricing page with plan comparison table
/recruit/billing        — Billing management (current plan, invoices, upgrade)
```

**Pricing page design:**
- 3 columns (Free / Pro / Agency)
- Feature comparison table
- Most popular badge on Pro
- "Start Free Trial" CTA
- Seeker Pro section below

**In navbar/dashboard:** Add "⬆️ Upgrade" button if user is on free plan.

**Plan limit enforcement in UI:**
- When free user tries to create 3rd job: show modal "Upgrade to Pro to post unlimited jobs"
- When free user tries to enable Auto-Screening: show upgrade prompt

---

## PHASE 4 — Google Cloud + Gemini Direct (Days 17–19)
### Critical for: Hackathon requirement compliance

---

### FEATURE 4.1 — Ensure Gemini API is Direct

**Requirement:** "Must use Gemini API for at least one LLM call in the deployed application."

Current status: Gemini is used via Mesh API (aggregator). For hackathon compliance, ensure at least some calls go DIRECTLY to Gemini API.

**Action:**
- In `backend/src/ai/gemini.ts` — ensure the direct Gemini client is used for resume scoring (the primary AI feature)
- Add `X-AI-Provider: gemini-direct` response header to AI routes so judges can verify
- Add `/recruit/status` page showing: "✅ Powered by Google Gemini 2.0 Flash"

### FEATURE 4.2 — Deploy Backend to Google Cloud Run

**Why:** Judges want to see Google Cloud used. Render is not Google Cloud.

**Steps:**
1. Create `Dockerfile` in backend/
2. Deploy to Google Cloud Run (same region as frontend)
3. Update frontend `NEXT_PUBLIC_API_URL` to new Google Cloud Run URL
4. Keep Firebase (already Google) highlighted in submission

---

## PHASE 5 — Submission Polish (Days 19–21)

### FEATURE 5.1 — Demo Video Script

**3-minute video structure:**
1. (0:00-0:30) Hook: "Hiring is broken. 40 hours/week. $4,000 per hire. What if AI could do it for you?"
2. (0:30-1:30) Live Demo: Apply as candidate → AI auto-shortlists → Email sent automatically → No human action
3. (1:30-2:00) Recruiter view: Daily briefing email, Pipeline rules, Performance alerts
4. (2:00-2:30) Job Seeker side: Match score, Resume builder, Interview prep
5. (2:30-3:00) "Real business. Real users. Real revenue. Built on Google Gemini."

### FEATURE 5.2 — Landing Page Stats (Social Proof)
Add to homepage (`/`) these live counters:
- "X jobs posted"
- "Y candidates processed"  
- "Z hours saved by AI"
- "A% average time-to-shortlist reduction"

### FEATURE 5.3 — Submission Checklist
- [ ] Devpost submission form filled
- [ ] Category: "Entrepreneurship & Job Creation" selected
- [ ] Video uploaded (≤3 min)
- [ ] GitHub repo URL (public or shared with testing@devpost.com, judging@hacker.fund)
- [ ] Live URL: https://www.rolebolt.tech/
- [ ] Description mentions: Gemini API, Firebase (Google), Google Cloud Run
- [ ] Revenue/user screenshots included

---

## 📋 Implementation Order Summary

```
Day 1-2:   Feature 1.1 — AI Auto-Screening Agent (backend + frontend)
Day 3:     Feature 1.2 — AI Pipeline Manager (backend + frontend)
Day 4:     Feature 1.3 — AI Daily Recruiter Briefing (backend cron + email template)
Day 5:     Feature 1.4 — AI Job Performance Monitor (backend + frontend tab)
Day 6:     Feature 2.1 — Job Seeker Account System (model + auth routes + pages)
Day 7-8:   Feature 2.2 — AI Resume Builder (backend AI route + conversational UI)
Day 9:     Feature 2.3 — AI Job Match Score (enhance existing route + UI)
Day 10:    Feature 2.4 — AI Cover Letter Generator (backend route + page)
Day 11-12: Feature 2.5 — AI Interview Prep (backend routes + multi-step UI)
Day 13:    Feature 2.6 — AI Profile Optimizer (backend route + profile page section)
Day 14:    Feature 2.7 — Smart Job Alerts (model + cron + email template)
Day 15-16: Feature 3.1 — Stripe Subscription (backend + pricing page + billing page)
Day 17:    Feature 4.1 — Gemini API Direct verification + status page
Day 18:    Feature 4.2 — Google Cloud Run deployment
Day 19-20: Feature 5.1-5.3 — Video, landing page stats, submission
Day 21:    Submit on Devpost ✅
```

---

## ⚡ Key Technical Notes for Any AI Reading This

1. **Auth pattern:** All protected backend routes use `authMiddleware` which reads `Authorization: Bearer <jwt>` header. JWT is stored in frontend as cookie `rb_token` and localStorage. Always pass token in API calls.

2. **AI call pattern:** Use the existing `callAI()` function (or the Gemini client in `backend/src/ai/`) for all AI calls. It already has retry logic and fallback chain.

3. **Email pattern:** Always use `sendEmail()` from `backend/src/mailer.ts`. Add new template functions to `backend/src/emailTemplates.ts` following the existing `shell()` wrapper pattern.

4. **Frontend API calls:** Use the `apiUrl()` helper from `frontend/src/lib/api.ts` for all backend URLs. Never hardcode the backend URL.

5. **New MongoDB models:** Create in `backend/src/models/`, export the schema, import in `backend/src/index.ts` or the relevant router file.

6. **New backend routes:** Add new router files (e.g., `backend/src/seeker.ts`, `backend/src/billing.ts`) and register them in `backend/src/index.ts`.

7. **New frontend pages:** Follow Next.js App Router convention — create `frontend/src/app/[path]/page.tsx`. Protected seeker pages should use a `SeekerGuard` component similar to existing `RecruitGuard`.

8. **Environment variables needed to add:**
   - `STRIPE_SECRET_KEY` — Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
   - `STRIPE_PRO_PRICE_ID` — Stripe price ID for Pro plan
   - `STRIPE_AGENCY_PRICE_ID` — Stripe price ID for Agency plan
   - `STRIPE_SEEKER_PRICE_ID` — Stripe price ID for Seeker Pro plan
   - `CRON_ENABLED=true` — Enable cron jobs in production
