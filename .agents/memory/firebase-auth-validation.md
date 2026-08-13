---
name: Firebase authentication validation
description: Distinguishes malformed Firebase Admin configuration from invalid or expired user ID tokens.
---

Validate Firebase authentication in two stages: first confirm the Admin service account parses and matches the browser project, then test token verification with a deliberately invalid token. A configured project should reject the fake token with a Firebase auth error, not a configuration error.

**Why:** A present-but-malformed service-account secret can make every real client token appear to be invalid, which hides the actual configuration problem.

**How to apply:** When auth reports invalid tokens, check service-account parsing, client/server project alignment, and provider/domain configuration before changing token refresh or role logic.