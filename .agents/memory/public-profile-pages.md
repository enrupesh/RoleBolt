---
name: Public username profiles
description: Public seeker and creator pages use server-rendered routes backed by privacy-filtered DTOs.
---

Public username pages are intentionally separate from authenticated profile payloads: the backend owns the allowlist, normalizes usernames, checks role ownership, and only exposes active public creator jobs. The frontend renders `/seeker/:username` as a portfolio and `/creator/:username` as a company or hiring-brand page with dynamic SEO, JSON-LD, and shareable URLs.

**Why:** Usernames are public identity, but authenticated profile documents contain private contact details, resume text, and recruiter-only fields that must never be reused directly.

**How to apply:** Add future public profile fields to the DTO allowlist first, then update the role-specific server-rendered page and structured data. Populate-state runtime checks require a configured `MONGODB_URI`; without it, the API should fail explicitly while the frontend shows its branded unavailable state.