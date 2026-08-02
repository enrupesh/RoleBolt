---
name: seeker-getuid-mismatch
description: seeker.ts getUid() was reading wrong field causing all seeker DB queries to return empty
---

The `getUid()` helper in `backend/src/seeker.ts` was reading `user._id` then `user.id`, but `authMiddleware.ts` sets `req.user = { uid: payload.sub, email }` — so both reads returned `undefined` and getUid() returned `""`.

Result: every `RecruitCandidate.find({ uid: "" })` and `RecruitSeekerProfile.findOne({ uid: "" })` returned empty — seeker dashboard showed 0 for all stats.

**Fix:** `user?.uid ?? user?._id?.toString() ?? user?.id?.toString() ?? ""`

**Why:** recruit.ts already had the correct pattern (`user?.uid`); seeker.ts was written inconsistently. If authMiddleware ever changes the field name, update both files.

**How to apply:** Any new router file that needs the current user's ID should copy the pattern from `recruit.ts` (`user?.uid`), not invent its own.
