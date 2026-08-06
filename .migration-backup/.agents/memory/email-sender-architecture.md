---
name: Email sender architecture
description: Durable rules and caveats for Rolebolt's outbound email sender identities and Resend mailer.
---

All outbound email currently goes through the backend's single Resend client. `verify@rolebolt.tech` is the default auth/default-mailer sender, while candidate and notification constants default to `notification@rolebolt.tech` (singular); the requested `verify.rolebolt.tech` and `notifications.rolebolt.tech` hostnames are not application endpoints.

**Why:** Several collaboration call sites omit an explicit `from`, causing internal notifications to use the mailer default, and the candidate/notification defaults are currently identical. This makes sender semantics depend on call-site omissions and environment overrides.

**How to apply:** Keep authentication/security mail on the verify identity, make all other automated mail choose an explicit centralized sender, and treat Resend/domain verification as provider configuration rather than SMTP code. Do not infer subdomain usage from the email local-part.