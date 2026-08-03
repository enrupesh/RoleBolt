---
name: Signup welcome experience
description: Product rule for the post-signup welcome and plan exploration experience.
---

The post-signup celebration should appear only after authentication and required username/onboarding setup are complete. Email verification screens and username setup must remain uninterrupted. The plan selector is role-aware: seekers explore the seeker category, while job creators explore Standard Jobs by default; Free selection should reassure users that they can upgrade later.

**Why:** A celebratory moment works best after the account is actually usable, and role-specific billing prevents a new user from landing in the wrong plan category.

**How to apply:** Keep the welcome state one-time and client-local, consume it only for the matching role, and preserve a dismiss/later path alongside plan exploration.

The welcome modal must be mounted once above both recruiter and seeker routes. Auth responses expose the stored signup role, while social OAuth returns an explicit new-account signal so login-as-signup does not show the modal accidentally. Email verification marks the pending welcome before the user signs in.

**Why:** Nested auth providers caused recruiter and seeker post-signup state to diverge, and provider login flows otherwise cannot distinguish a newly created account from an existing account.

**How to apply:** Keep role resolution in the shared auth provider; mark signup intent only for newly created Google/GitHub/phone accounts and after successful email verification.