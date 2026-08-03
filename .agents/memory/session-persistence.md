---
name: Session persistence and auth redirect
description: Root cause and fix for session loss on Render cold starts, cookie storage strategy, and auto-redirect for authenticated users.
---

## The problem
- Token was stored in `localStorage` only.
- The init effect called `.catch(() => localStorage.removeItem(TOKEN_KEY))` — meaning any network failure (Render cold start / backend sleeping) would silently wipe a valid token.
- No auto-redirect: landing page, login, and signup showed themselves to already-authenticated users.

## The fix

### Dual storage (`frontend/src/lib/tokenCookie.ts`)
- Token is now written to BOTH `localStorage` AND a first-party `document.cookie` (SameSite=Lax, max-age=30 days).
- On init, read `localStorage` first; fall back to cookie if localStorage is missing or empty.
- Helpers: `setTokenCookie`, `getTokenCookie`, `clearTokenCookie`.

### Resilient init in `RecruitAuthContext.tsx`
- On 401/403 from `/auth/me` → wipe token (genuinely invalid).
- On 5xx or network error → **keep** the token, restore minimal session state, let user stay logged in. Do NOT call `wipeToken()`.
- On success → call `persistToken()` to refresh both stores and extend cookie TTL.

### Auto-redirect
- `frontend/src/app/recruit/page.tsx` (landing): `useEffect` redirects to `/recruit/dashboard` when `!loading && isLoggedIn`. Returns `null` while loading to prevent flash.
- `frontend/src/app/recruit/login/page.tsx`: same pattern. Renamed local form loading state to `submitting` to avoid collision with auth context `loading`.
- `frontend/src/app/recruit/signup/page.tsx`: same pattern, auth loading exposed as `authLoading`.

**Why:** Render free tier cold starts take 30+ seconds; the old `.catch` treated every timeout as a bad token. Never wipe a token unless the server explicitly rejects it (401/403).
