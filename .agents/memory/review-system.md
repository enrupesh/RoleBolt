---
name: Review system
description: Public Rolebolt reviews use one admin-controlled landing toggle, shared review modal, and identical public badges for registered and guest submissions.
---

The review experience is intentionally unified: footer, seeker dashboard, creator dashboard, and `/reviews` open the same modal; registered users are upserted by account and guests choose seeker or creator. Review cards never show dates or times and always display the same `Verified Job Seeker` or `Verified Job Creator` badge.

**Why:** The user explicitly wants guest and account reviews treated identically in the public UI, while retaining admin control over which reviews are featured on the landing page.

**How to apply:** Keep the landing featured-review toggle as the single product control: ON shows the featured section and restricts submissions to account users; OFF hides that section and allows guest role selection. Admin may still hide or delete abusive reviews.