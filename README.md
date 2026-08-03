# Recruit — Standalone Project

This is a standalone extraction of the "Recruit" tool (jobs, applications, AI resume
matching) from the main Rolebolt app. It is a self-contained two-part project:

- `backend/` — Express + MongoDB + Firebase Admin API server (only the recruit routes)
- `frontend/` — Next.js app with only the recruit pages (`/recruit`, `/recruit-public`)

It is wired to work exactly like it does inside rolebolt.app today — same database
model shapes, same auth flow, same API contract — so if you point it at the same
MongoDB and Firebase project, existing data and logins keep working.

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_JSON, GEMINI_MESH_KEY, GEMINI_PRIMARY_KEY, GEMINI_FALLBACK_KEY, CORS_ORIGIN
npm run dev             # local dev on port 8080
```

Deploy `backend/` to any Node host (Render, Railway, Fly.io, etc.). Build with
`npm run build` and start with `npm start`.

### Google reCAPTCHA v3 (optional, free — no billing)

Set `RECAPTCHA_SECRET_KEY` on the backend and `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` on the frontend.
Register at: https://www.google.com/recaptcha (Score based v3).
Protects the job application form from spam bots — scores below 0.5 are rejected.

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in BACKEND_URL + Firebase client keys
npm run dev                   # local dev on port 5000
```

Deploy `frontend/` to Vercel (recommended for Next.js) or any Node host. Set
`BACKEND_URL` to your deployed backend's URL, and set `CORS_ORIGIN` on the backend
to your deployed frontend's URL.

## Notes

- **Database**: point `MONGODB_URI` at the same database the main app uses if you
  want to keep sharing recruit data, or a fresh database for a clean split.
- **Auth**: point the Firebase env vars at the same Firebase project used by the
  main app if you want existing recruit users to keep their accounts, or create a
  new Firebase project for fully independent auth.
- **Custom domain**: once deployed, point your new domain at the frontend
  deployment (e.g. Vercel domain settings).

## Billing (Phase 0 foundation)

Backend billing lives under `backend/src/billing/`. Product contracts:

- [`payment.md`](./payment.md) — prices, limits, customer rules
- [`paymentgateway.md`](./paymentgateway.md) — phased implementation roadmap

### One-time Free entitlement migration

New signups automatically receive three Free category subscriptions
(`seeker`, `creator_form`, `creator_standard`). Existing users need a one-time backfill:

```bash
cd backend
npm run billing:migrate-free
```

Requires `MONGODB_URI`. The command is idempotent (`$setOnInsert` only).

### Billing tests

```bash
cd backend
npm test
# MongoDB integration reservation tests (concurrent limits, signup records):
MONGODB_URI=mongodb://127.0.0.1:27017/rolebolt_billing_test npm test
# or MONGODB_TEST_URI=...
```

### Razorpay plan sync (later phases)

```bash
cd backend
npm run billing:sync-razorpay-plans
```
