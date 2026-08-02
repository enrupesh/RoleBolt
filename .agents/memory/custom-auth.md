---
name: Custom auth system
description: Full custom JWT auth (signup, login, email verification) — replaces Clerk/Firebase entirely.
---

## Architecture

- **User model**: `backend/src/models/User.ts` — email, passwordHash (bcrypt), name, isVerified, verificationToken, verificationTokenExpiry
- **Auth router**: `backend/src/auth.ts` — POST /auth/signup, POST /auth/login, POST /auth/verify-email, POST /auth/resend-verification, GET /auth/me
- **JWT middleware**: `backend/src/authMiddleware.ts` — `signToken()` / `verifyToken()` / `requireAuth` (reads Bearer from Authorization header)
- **Frontend context**: `frontend/src/contexts/RecruitAuthContext.tsx` — stores JWT in `localStorage` under key `rb_auth_token`; verifies on mount via GET /auth/me; provides `signIn`, `signOut`, `signOutFromRecruit`, `refreshProfile`

## Token strategy
- JWT signed with `SESSION_SECRET`, 30-day expiry
- Frontend sends `Authorization: Bearer <token>` on all protected requests
- `req.user = { uid: user._id.toString(), email }` set by middleware

## Email verification
- Token: `crypto.randomBytes(32).toString('hex')`, 24h TTL
- Sent via Resend (`RESEND_API_KEY`), from `SMTP_FROM_EMAIL` (default `noreply@rolebolt.tech`)
- Link points to `{FRONTEND_URL}/recruit/verify-email?token=<token>`
- Frontend page calls POST /auth/verify-email with token in body

## Required env vars (backend)
- `SESSION_SECRET` — JWT signing secret
- `RESEND_API_KEY` — Resend API key
- `SMTP_FROM_EMAIL` — verified sender (e.g. verify@rolebolt.tech)
- `SMTP_FROM_NAME` — display name (Rolebolt)
- `FRONTEND_URL` — base URL for verification links (e.g. https://rolebolt.tech)
- `MONGODB_URI` — database

## Backend URL
- Production backend: `https://back-mp9k.onrender.com` (hardcoded in `frontend/src/lib/api.ts` as DEFAULT_BACKEND_URL)
- All env vars above must also be set on Render (they are Replit Secrets here for local dev only)

**Why:** Clerk removed entirely; this is the permanent auth foundation. RecruitProfile is still separate (role scoping) — created on first login by frontend context.
