---
name: Seeker system architecture
description: How the job seeker role system, auth, routing, and guard work across frontend and backend
---

## Role System
- Role is stored in `RecruitProfile` model (`role: "creator" | "seeker"`), NOT in `User` model.
- `RecruitGuard` checks `recruitProfile.role` against `requiredRole` prop.
- Seeker pages: `<RecruitGuard requiredRole="seeker">`, creator pages: `<RecruitGuard requiredRole="creator">`

## Seeker Auth Flow (signup)
1. POST /auth/signup → get JWT token
2. PATCH /recruit/auth/profile with `{ role: "seeker" }` — uses upsert, creates profile if not exists
3. PUT /recruit/seeker/profile to initialize seeker profile data
4. signInWithToken(token) — syncs context

## Guard Redirect Logic
- Unauthenticated + seeker page → `/seeker/login`
- Unauthenticated + creator page → `/recruit/login`
- Creator role + seeker page → `/recruit/dashboard`
- Seeker role + creator page → `/seeker/dashboard`

## Backend Routes
- Seeker routes mounted at: `app.use("/recruit/seeker", requireAuth, seekerRouter)` in index.ts
- Frontend calls: `/recruit/seeker/profile`, `/recruit/seeker/applications`, etc.

## RecruitAuthContext auto-create
- If profile doesn't exist on token verify, auto-creates with `role: "creator"` via POST /recruit/auth/profile
- This is fine for seekers because seeker signup PATCH /recruit/auth/profile uses upsert=true and runs before signInWithToken

**Why:** Seeker pages won't work without `requiredRole="seeker"` in RecruitGuard — guard redirects to right login page based on requiredRole prop.
