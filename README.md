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

### Razorpay billing (Phase 5)

**Required server environment variables (never expose to the frontend):**

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
RAZORPAY_PLAN_SEEKER_PRO_MONTHLY
RAZORPAY_PLAN_SEEKER_PRO_YEARLY
RAZORPAY_PLAN_SEEKER_ULTRA_MONTHLY
RAZORPAY_PLAN_SEEKER_ULTRA_YEARLY
RAZORPAY_PLAN_CREATOR_FORM_PRO_MONTHLY
RAZORPAY_PLAN_CREATOR_FORM_PRO_YEARLY
RAZORPAY_PLAN_CREATOR_FORM_ULTRA_MONTHLY
RAZORPAY_PLAN_CREATOR_FORM_ULTRA_YEARLY
RAZORPAY_PLAN_CREATOR_STANDARD_PRO_MONTHLY
RAZORPAY_PLAN_CREATOR_STANDARD_PRO_YEARLY
RAZORPAY_PLAN_CREATOR_STANDARD_ULTRA_MONTHLY
RAZORPAY_PLAN_CREATOR_STANDARD_ULTRA_YEARLY
# (18 paid plan IDs total — sync command prints any missing keys)
```

**Plan sync (test mode first):**

```bash
cd backend
npm run billing:sync-razorpay-plans
```

**Webhook registration (Razorpay Dashboard):**

- URL: `https://<API_HOST>/billing/webhook`
- Must receive the **raw** JSON body (the backend mounts this route before `express.json()`)
- Subscribe to subscription lifecycle events (activated, charged, pending, halted, cancelled, completed, etc.) and payment failed events when available

**Authenticated billing APIs:**

| Method | Path | Purpose |
|---|---|---|
| POST | `/billing/create-checkout` | Free → paid (Idempotency-Key required) |
| POST | `/billing/verify-checkout` | Ack client signature only — **never activates** |
| POST | `/billing/cancel-subscription` | Schedule cancel at period end |
| POST | `/billing/change-plan` | Upgrade now / downgrade at cycle end |
| POST | `/billing/cancel-pending-plan-change` | Undo a scheduled downgrade |
| POST | `/billing/reconcile-subscription` | Repair one category from Razorpay |
| POST | `/billing/webhook` | Provider HMAC webhook (public, raw body) |

Checkout success redirects and `verify-checkout` **cannot** grant paid access. Only a verified webhook or reconciliation write can.

**Reconciliation CLI (missed webhooks / drift):**

```bash
cd backend
npm run billing:reconcile -- --dry-run
npm run billing:reconcile -- --user <userId> --category seeker
npm run billing:reconcile
```

**Go-live sequence:**

1. Configure test-mode Razorpay keys + 18 plan IDs + webhook secret
2. Register test webhook URL and run checkout → webhook → entitlement smoke
3. Verify cancel-at-period-end, failed payment (`pending`/`past_due`), and reconciliation repair
4. Only then switch to live keys
5. Deploy Phase 6 frontend before advertising paid checkout to customers
