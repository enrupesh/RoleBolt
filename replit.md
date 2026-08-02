# Recruit — Standalone ATS Project

## Overview
A standalone extraction of the "Recruit" tool from the main Rolebolt app. Self-contained two-part project:

- `backend/` — Express + MongoDB + Firebase Admin API server (recruit routes only)
- `frontend/` — Next.js app with `/recruit` and `/recruit-public` pages

## How to Run

### Backend
- Workflow: `Backend` → `cd backend && npm run dev` (port 8080)
- Requires env vars: `MONGODB_URI`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `GEMINI_MESH_KEY`, `GEMINI_PRIMARY_KEY`, `GEMINI_FALLBACK_KEY`, `CORS_ORIGIN`
- Optional: `RECAPTCHA_SECRET_KEY` for bot protection

### Frontend
- Workflow: `Start application` → `cd frontend && npm run dev` (port 5000)
- Requires env vars: `BACKEND_URL`, Firebase client keys
- Optional: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`

## Stack
- **Backend**: Node.js, Express, TypeScript, MongoDB/Mongoose, Firebase Admin SDK, Gemini AI (via `callGeminiChain`)
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Recharts, jsPDF, Lucide React
- **Auth**: Custom JWT (signup/login/email verify), Firebase social auth (Google, GitHub, phone OTP)

## Key Features
- Standard job postings with AI-powered resume scoring
- Candidate pipeline (applied → screened → assessed → interview → offer → hired)
- AI Agent mode (auto-shortlist/reject based on score thresholds)
- Assessment system with AI scoring and decisions
- **Job Analysis** tab — comprehensive analytics with health score, pipeline funnel, quality tiers, timeline charts, source breakdown, assessment metrics, and AI-generated insights
- Pipeline Rules (auto-move candidates based on conditions)
- Offer letter workflow with e-sign
- Collaboration (job-scoped team access)
- Daily briefing emails (cron job at 8AM UTC, `CRON_ENABLED=true`)
- Bulk resume import (up to 50 files via SSE streaming)

## Route Structure

### Backend (`/recruit/...`)
- `GET /jobs/:id/job-analysis` — Comprehensive job analysis with AI health score
- `GET /jobs/:id/assessment-analytics` — Assessment-specific analytics
- `GET /analytics` — Aggregate recruiter analytics
- Full CRUD for jobs, candidates, pipeline rules, offers, collaboration, etc.

### Frontend (`/recruit/...`)
- `/recruit/dashboard` — Recruiter dashboard
- `/recruit/jobs/[id]` — Job detail with tabs: Pipeline, JD, Rubric, Rules, Performance, Agent Log, Assessment Analytics, Live Progress, Collaboration, AI Hiring, **Job Analysis**
- `/recruit/analytics` — Aggregate analytics page
- `/recruit-public/jobs/[id]` — Public job application form

## User Preferences
- Keep existing project structure and stack; do not restructure or migrate
