# Recruit — Standalone Project

This is a standalone extraction of the "Recruit" tool (jobs, applications, AI resume
matching) from the main Plyndrox app. It is a self-contained two-part project:

- `backend/` — Express + MongoDB + Firebase Admin API server (only the recruit routes)
- `frontend/` — Next.js app with only the recruit pages (`/recruit`, `/recruit-public`)

It is wired to work exactly like it does inside plyndrox.app today — same database
model shapes, same auth flow, same API contract — so if you point it at the same
MongoDB and Firebase project, existing data and logins keep working.

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env   # fill in MONGODB_URI, FIREBASE_SERVICE_ACCOUNT_JSON, NVIDIA_API_KEY, CORS_ORIGIN
npm run dev             # local dev on port 8080
```

Deploy `backend/` to any Node host (Render, Railway, Fly.io, etc.). Build with
`npm run build` and start with `npm start`.

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
