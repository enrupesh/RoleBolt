# Rolebolt

**AI-native recruiting and job-search workspace** — hire faster with rubric-based scoring, pipeline automation, and a Gemini-powered copilot. Job seekers get match scores, application tracking, and career tools in one place.

**Live product:** [rolebolt.tech](https://www.rolebolt.tech)  
**Judges testing kit:** [rolebolt.tech/recruit/judges](https://www.rolebolt.tech/recruit/judges)

---

## Overview

Rolebolt is a full-stack hiring platform built for small teams and growing companies. Recruiters create standard or structured form jobs, import resumes in bulk, review candidates with AI-assisted rubrics, automate pipeline actions, and collaborate with their team. Candidates browse public opportunities, see fit scores before applying, and manage their job search in a dedicated seeker workspace.

The product is **AI-native**: Google Gemini powers job description generation, resume scoring, form assessments, recruiting copilot conversations, daily briefings, and the Sitegen portfolio builder.

---

## Features

### For recruiters

| Feature | Description |
|---------|-------------|
| **Standard jobs** | Full ATS pipeline with stages, bulk resume import, and AI rubric scoring |
| **Form jobs** | Structured applications with async assessments and applicant timelines |
| **AI Copilot** | Ask questions about candidates, roles, and hiring data with grounded answers |
| **Hiring Autopilot** | Pipeline rules that automate repeatable actions (stage moves, emails) |
| **What-If simulator** | Model pipeline changes before committing |
| **Private jobs** | Publish roles visible only via direct link (hidden from Find Jobs) |
| **Offers** | Draft, version, and send candidate signing links |
| **Collaboration** | Team notes, activity feed, and shared candidate review |
| **Analytics** | Funnel metrics, source quality, and hiring pace |
| **Billing** | Free tier plus Razorpay subscriptions (Pro / Ultra) |

### For job seekers

| Feature | Description |
|---------|-------------|
| **Find Jobs** | Browse public opportunities with filters and job alerts |
| **Match scores** | See how your profile maps to a role before applying |
| **Career workspace** | Resumes, cover letters, application tracker, interview prep |
| **Public profiles** | Shareable seeker and creator profile pages |

### Additional products

- **Sitegen** — AI-generated portfolio websites from resume text (`/website`)
- **Community reviews** — Featured reviews, X posts, and video testimonials on the landing page

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, TypeScript |
| Backend | Express 5, TypeScript, tsx runtime |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini API, Mesh API (Gemini models), Nvidia NIM fallback |
| Auth | Custom JWT + email verification, Firebase (Google/Microsoft SSO) |
| Email | Resend |
| Payments | Razorpay |
| Deployment | Render (see `render.yaml`) |

---

## Project structure

```
.
├── backend/                 # Express API server
│   ├── src/
│   │   ├── ai/              # Gemini & Mesh clients
│   │   ├── automation/      # Pipeline rules & autopilot
│   │   ├── billing/         # Razorpay subscriptions & entitlements
│   │   ├── jobs/            # Cron jobs (briefings, offers)
│   │   ├── models/          # Mongoose schemas
│   │   ├── products/sitegen # Portfolio website builder
│   │   ├── recruit.ts       # Core recruiting routes
│   │   ├── recruitCopilot.ts
│   │   ├── recruitForms.ts
│   │   └── seeker.ts
│   └── .env.example
├── frontend/                # Next.js app
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # Shared UI components
│   │   ├── contexts/        # Auth & state
│   │   └── lib/             # API client, utilities
│   └── .env.example
├── Product_Evidence/        # Hackathon submission artifacts
├── render.yaml              # Render deployment blueprint
└── LICENSE
```

---

## Getting started

### Prerequisites

- **Node.js 20.x** (see `.node-version` in each package)
- **MongoDB** — local instance or Atlas connection string
- **Google Gemini API key** — for AI features
- **Resend API key** — for transactional email (optional in dev)

### 1. Clone and install

```bash
git clone <repo-url>
cd rolebolt

# Backend
cd backend
cp .env.example .env
# Edit .env with your values
npm install

# Frontend (new terminal)
cd ../frontend
cp .env.example .env.local
# Set BACKEND_URL=http://localhost:8080
npm install
```

### 2. Configure environment

**Backend** (`backend/.env`) — key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `SESSION_SECRET` | Yes | JWT signing secret (64+ random bytes) |
| `GEMINI_MESH_KEY` | Yes* | Mesh API key for scoring, copilot, forms |
| `GEMINI_PRIMARY_KEY` | Yes* | Direct Gemini API for JD generation |
| `FRONTEND_URL` | Yes | Public frontend URL (email links) |
| `CORS_ORIGIN` | Prod | Allowed frontend origin(s) |
| `RESEND_API_KEY` | Prod | Email delivery |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | SSO | Google/Microsoft sign-in |
| `RAZORPAY_*` | Billing | Payment processing |

\*At least one Gemini key is required for AI features to work.

**Frontend** (`frontend/.env.local`):

| Variable | Purpose |
|----------|---------|
| `BACKEND_URL` | Backend API base URL |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Bot protection on applications |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase client config for SSO |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Run locally

```bash
# Terminal 1 — backend (port 8080)
cd backend
npm run dev

# Terminal 2 — frontend (port 5000)
cd frontend
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

### 4. Run tests

```bash
# Backend unit tests
cd backend && npm test

# Frontend unit tests
cd frontend && npm test
```

---

## Deployment

The repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml`) that deploys two web services:

1. **recruit-backend** — Express API on port 8080
2. **recruit-frontend** — Next.js on port 5000

Set all `sync: false` environment variables in the Render dashboard. Point `BACKEND_URL` on the frontend to the deployed backend URL, and set `CORS_ORIGIN` / `FRONTEND_URL` on the backend to the frontend URL.

For Firebase SSO in production, paste the full service account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` — do not commit credential files.

---

## AI architecture

```
User request
    │
    ├─► Gemini Primary API (GEMINI_PRIMARY_KEY)
    │       Job descriptions, structured generation
    │
    ├─► Mesh API / Gemini models (GEMINI_MESH_KEY)
    │       Resume scoring, copilot, form evaluation, briefings
    │
    └─► Nvidia NIM fallback (GEMINI_FALLBACK_KEY)
            Automatic fallback when primary models are unavailable
```

Health endpoints at `/health` and `/ai-routing` report AI service status.

---

## Hackathon submission

Rolebolt is submitted to the **Build with Gemini XPRIZE** ([Devpost](https://xprize.devpost.com/)).

- **Category:** Professional Services / Small Business Services
- **Judges page:** [/recruit/judges](https://www.rolebolt.tech/recruit/judges) — sample jobs, resumes, and walkthrough
- **Judge's technical brief:** [`JUDGES.md`](JUDGES.md) — Google Cloud stack, architecture diagrams, Gemini usage, roadmap
- **Evidence folder:** `Product_Evidence/` — add GCP billing, Gemini usage screenshots, and revenue proof before final submission

---

## Security notes

- Never commit `.env` files, `firebase-service-account.json`, or API keys
- `RAKA98_ADMIN_PASSWORD` secures the internal verification admin panel
- reCAPTCHA v3 protects public job applications
- Razorpay webhooks are verified with HMAC signatures

---

## License

**Proprietary — all rights reserved by Rolebolt.**

This repository is public so Build with Gemini / XPRIZE judges can evaluate the submission. Public access is **not** an open-source license and does **not** grant the general public permission to use, copy, modify, fork, commercialize, or build another product from this code. See [LICENSE](LICENSE).
