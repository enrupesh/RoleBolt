# RoleBolt — AI-Native Hiring Platform

## Project Overview
RoleBolt is a full-stack AI-powered hiring platform built for the Google Gemini XPRIZE Hackathon (deadline: Aug 17, 2026). It has two sides: a recruiter dashboard for managing jobs and candidates, and a job seeker portal with AI tools.

**Live URLs:**
- Frontend (production): https://www.rolebolt.tech/
- Backend (production): https://back-mp9k.onrender.com/

## Tech Stack
- **Frontend:** Next.js 16 (App Router, Turbopack), TypeScript, Tailwind CSS, Framer Motion — port 5000
- **Backend:** Express.js, TypeScript, MongoDB (Mongoose), Resend email — port 8080
- **Auth:** Custom JWT (`rb_token` cookie + localStorage), Firebase for social auth (Google/GitHub/phone)
- **AI:** Google Gemini (primary) → Mesh API (fallback) → NVIDIA NIM (last fallback)
- **Payments:** Stripe subscriptions (Pro $49/mo, Agency $149/mo, Seeker Pro $9/mo)

## How to Run
```bash
# Backend (port 8080)
cd backend && npm install && npm run dev

# Frontend (port 5000)
cd frontend && npm install && npm run dev
```

## Project Structure
```
backend/src/
  index.ts           — Express app entry, registers all routers
  recruit.ts         — Main recruiter router (3000+ lines)
  seeker.ts          — Seeker router (mounted at /recruit/seeker)
  billing.ts         — Stripe billing router
  auth.ts            — Auth router
  recruitForms.ts    — Custom screening forms
  recruitCopilot.ts  — AI Copilot (SSE streaming)
  siteGuideChat.ts   — Site guide chatbot
  jobs/
    dailyBriefing.ts — Cron job (8AM UTC) + sendJobAlerts
  models/            — All Mongoose models
  ai/                — geminiClient, meshClient, nvidiaClient

frontend/src/
  app/
    recruit/         — Recruiter pages (login, dashboard, jobs, analytics, etc.)
    seeker/          — Seeker pages (dashboard, profile, resume, cover-letter, etc.)
    f/[slug]/        — Public custom form submission
  components/
    RecruitGuard.tsx — Auth protection (requiredRole: "creator" | "seeker")
    RecruitHeader.tsx — Recruiter nav (creator role)
    SeekerHeader.tsx  — Seeker nav
  contexts/
    RecruitAuthContext.tsx — Auth state
  lib/
    api.ts           — apiUrl() helper (defaults to https://back-mp9k.onrender.com)
```

## Key Routes
- `/` → redirects to `/recruit` (landing page)
- `/recruit/*` — Recruiter pages (most protected by RecruitGuard requiredRole="creator")
- `/seeker/*` — Seeker pages (protected by RecruitGuard requiredRole="seeker")
- `/recruit/opportunities` — Public job board
- `/recruit/opportunities/[id]` — Public job detail with AI match score
- `/f/[slug]` — Public custom form submission

## Environment Secrets Required
Backend (on Render):
- `MONGODB_URI` — MongoDB Atlas connection string
- `SESSION_SECRET` — JWT signing secret (set in Replit secrets)
- `RESEND_API_KEY` — Email sending
- `GEMINI_MESH_KEY` — Mesh API key
- `GEMINI_PRIMARY_KEY` — Direct Gemini API key
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, etc.
- `CRON_ENABLED=true` — Enables daily briefing cron

Frontend:
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` — reCAPTCHA v3 (optional)

## Implementation Status (as of July 29, 2026)
| Feature | Status |
|---------|--------|
| 1.1 AI Agent Mode Toggle | ✅ Complete |
| 1.2 AI Pipeline Rules | ✅ Complete |
| 1.3 AI Daily Briefing | ✅ Complete |
| 1.4 AI Job Performance Monitor | ✅ Complete |
| 2.1 Seeker Account System | ✅ Complete |
| 2.2 AI Resume Builder | ✅ Complete |
| 2.3 AI Job Match Score | ✅ Complete |
| 2.4 AI Cover Letter Generator | ✅ Complete |
| 2.5 AI Interview Prep | ✅ Complete |
| 2.6 AI Profile Optimizer | ✅ Complete |
| 2.7 Smart Job Alerts | ✅ Complete |
| 3.1 Stripe Subscriptions | ✅ Complete |
| 1.5 JD Generator Enhancement | ⏳ Pending |
| 1.6 Salary Benchmarking | ⏳ Pending |
| 4.1 Gemini API Verification | ⏳ Pending |
| 4.2 Google Cloud Run Deployment | ⏳ Pending |
| 5.1-5.3 Hackathon Submission | ⏳ Pending |

## User Preferences
- Fix bugs immediately rather than just reporting them
- Full end-to-end verification after every change
- TypeScript must be clean (zero errors) at all times
