/**
 * Custom authentication — signup, login, email verification, password reset.
 *
 * Routes (all mounted under /auth in index.ts):
 *   POST /auth/signup               — create account, send verification email
 *   POST /auth/login                — verify credentials, return JWT
 *   POST /auth/verify-email         — verify email with token from URL
 *   POST /auth/resend-verification  — resend verification email
 *   GET  /auth/me                   — return current user (requires Bearer token)
 *   POST /auth/forgot-password      — send password reset email
 *   POST /auth/reset-password       — set new password with reset token
 */

import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectMongo } from "./db";
import { User } from "./models/User";
import { signToken, verifyToken, requireAuth } from "./authMiddleware";
import { sendEmail } from "./mailer";
import { AUTH_FROM } from "./emailConfig";
import { verifyFirebaseToken } from "./firebaseAdmin";
import { RecruitProfile } from "./models/RecruitProfile";
import { RecruitSeekerProfile } from "./models/RecruitSeekerProfile";
import { initializeFreeEntitlements } from "./billing/entitlements";
import { ensureJudgeReviewerEntitlements } from "./billing/judgeReviewerEntitlements";
import { RecruitAuthSettings } from "./models/RecruitAuthSettings";
import { isJudgeReviewerEmail } from "./judgeReviewer";

export const authRouter = express.Router();

// ─── Config ───────────────────────────────────────────────────────────────────

// Guard: reject any stale/incorrect FRONTEND_URL values so email links always point to the real domain.
const _rawFrontendUrl = process.env.FRONTEND_URL ?? "";
const FRONTEND_URL = (
  _rawFrontendUrl &&
  !_rawFrontendUrl.includes("forjob.onrender.com") &&
  !_rawFrontendUrl.includes("localhost") &&
  !_rawFrontendUrl.includes("127.0.0.1")
    ? _rawFrontendUrl
    : "https://www.rolebolt.tech"
).replace(/\/$/, "");
const BCRYPT_ROUNDS    = 12;
const TOKEN_TTL_MS     = 24 * 60 * 60 * 1000;       // 24 h  (email verification)
const RESET_TTL_MS     =  1 * 60 * 60 * 1000;       //  1 h  (password reset)

const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const USERNAME_PATTERN = /^[a-z][a-z0-9_]*$/;
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "auth", "help", "login", "logout", "me",
  "profile", "recruit", "recruiter", "rolebolt", "root", "seeker", "signup",
  "support", "system", "www", "null", "undefined",
]);

function normalizeUsername(raw: unknown): string {
  // Canonicalise case and whitespace, but do not silently remove invalid
  // characters. Validation must reject malformed API requests consistently.
  return String(raw ?? "").trim().toLowerCase();
}

function validateUsername(raw: unknown): { username: string } | { error: string } {
  const username = normalizeUsername(raw);
  if (!username) return { error: "Username is required." };
  if (username.length < USERNAME_MIN) return { error: `Username must be at least ${USERNAME_MIN} characters.` };
  if (username.length > USERNAME_MAX) return { error: `Username must be at most ${USERNAME_MAX} characters.` };
  if (!USERNAME_PATTERN.test(username)) {
    return { error: "Username must start with a letter and contain only letters, numbers, and underscores." };
  }
  if (RESERVED_USERNAMES.has(username)) return { error: "This username is reserved. Please choose another." };
  return { username };
}

async function createUserWithBillingEntitlements(
  data: Parameters<typeof User.create>[0],
): Promise<InstanceType<typeof User>> {
  const user = await User.create(data);
  await initializeFreeEntitlements(user._id.toString());
  await ensureJudgeReviewerEntitlements(user._id.toString(), user.email);
  return user;
}

async function finalizeJudgeReviewerAccess(user: InstanceType<typeof User>): Promise<void> {
  await ensureJudgeReviewerEntitlements(user._id.toString(), user.email);
}

function userPublicDto(user: {
  _id: { toString(): string };
  email?: string;
  username?: string;
  name?: string;
  signupRole?: SignupRole;
}) {
  return {
    id: user._id.toString(),
    email: user.email ?? "",
    username: user.username ?? "",
    name: user.name ?? "",
    signupRole: user.signupRole,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** @deprecated use makeToken() */
function makeVerificationToken(): string { return makeToken(); }

type SignupRole = "creator" | "seeker";

async function emailVerificationIsRequired(): Promise<boolean> {
  const settings = await RecruitAuthSettings.findOne().select("requireEmailVerification").lean();
  return settings?.requireEmailVerification !== false;
}

function parseSignupRole(raw: unknown): SignupRole | null {
  if (raw === undefined || raw === null || raw === "") return "creator";
  return raw === "creator" || raw === "seeker" ? raw : null;
}

function parseRequestedRole(raw: unknown): SignupRole | null {
  if (raw === undefined || raw === null || raw === "") return null;
  return raw === "creator" || raw === "seeker" ? raw : null;
}

async function resolveRequestedRole(
  user: { _id: { toString(): string }; email?: string; signupRole?: SignupRole; save(): Promise<unknown> },
  requestedRole: SignupRole | null,
): Promise<{ role: SignupRole | null; mismatch: boolean }> {
  const storedRole = await getStoredSignupRole(user);
  const isJudgeReviewer = isJudgeReviewerEmail(user.email);
  if (isJudgeReviewer && user.signupRole !== "creator") {
    user.signupRole = "creator";
    await user.save();
  }
  const canonicalRole = isJudgeReviewer ? "creator" : storedRole;
  if (requestedRole && canonicalRole && requestedRole !== canonicalRole) {
    return { role: canonicalRole, mismatch: true };
  }
  if (requestedRole && !user.signupRole) {
    user.signupRole = requestedRole;
    await user.save();
  }
  return { role: canonicalRole ?? requestedRole, mismatch: false };
}

async function getStoredSignupRole(
  user: { _id: { toString(): string }; signupRole?: SignupRole },
): Promise<SignupRole | null> {
  if (user.signupRole) return user.signupRole;
  const profile = await RecruitProfile.findOne({ uid: user._id.toString() }).select("role").lean();
  return profile?.role === "seeker" || profile?.role === "creator" ? profile.role : null;
}

async function sendVerificationEmail(
  email: string,
  name: string,
  token: string,
  role: SignupRole = "creator",
): Promise<void> {
  const verificationPath = role === "seeker" ? "/seeker/verify-email" : "/recruit/verify-email";
  const link = `${FRONTEND_URL}${verificationPath}?token=${token}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#0a66c2;padding:28px 36px;text-align:center;">
              <span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;">
                <span style="font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.2;">
                Verify your email address
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                ${name ? `Hi ${name}, welcome to Rolebolt!` : "Welcome to Rolebolt!"} Please confirm your email address to activate your account.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:12px;background:#0a66c2;box-shadow:0 4px 14px rgba(10,102,194,0.35);">
                    <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.1px;">
                      Verify Email Address
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#0a66c2;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                ${link}
              </p>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                This link expires in <strong style="color:#64748b;">24 hours</strong>. If you didn't create a Rolebolt account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © 2026 Rolebolt · <a href="https://rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Welcome to Rolebolt${name ? `, ${name}` : ""}!\n\nVerify your email address by visiting this link:\n${link}\n\nThis link expires in 24 hours.\n\nIf you didn't create a Rolebolt account, you can safely ignore this email.`;

  await sendEmail({ to: email, subject: "Verify your Rolebolt account", html, text, from: AUTH_FROM });
}

// ─── Config (backend base URL for OAuth callbacks) ───────────────────────────

const BACKEND_URL = (process.env.BACKEND_URL || "https://back-mp9k.onrender.com").replace(/\/$/, "");
type GitHubAuthTarget = "recruit" | "seeker";
type GitHubAuthIntent = "login" | "signup";

function getGitHubTarget(value: unknown): GitHubAuthTarget {
  return value === "seeker" ? "seeker" : "recruit";
}

function getGitHubIntent(value: unknown): GitHubAuthIntent {
  return value === "login" ? "login" : "signup";
}

function buildGitHubFrontendCallback(
  target: GitHubAuthTarget,
  intent: GitHubAuthIntent,
  params: Record<string, string>
): string {
  const search = new URLSearchParams({ target, intent, ...params });
  return `${FRONTEND_URL}/recruit/auth/callback?${search.toString()}`;
}

// ─── POST /auth/social — Firebase social login (Google, Microsoft) ────────────

authRouter.post("/social", async (req, res) => {
  try {
    const { idToken, provider, role } = req.body as {
      idToken?: string;
      provider?: string;
      role?: string;
    };

    if (!idToken?.trim()) return res.status(400).json({ error: "idToken is required." });
    if (!provider || !["google", "phone"].includes(provider)) {
      return res.status(400).json({ error: "provider must be 'google' or 'phone'." });
    }
    if (role !== undefined && !parseRequestedRole(role)) {
      return res.status(400).json({ error: "Invalid account role." });
    }
    const requestedRole = parseRequestedRole(role);

    // Verify the Firebase ID token
    let decoded: import("firebase-admin").auth.DecodedIdToken;
    try {
      decoded = await verifyFirebaseToken(idToken);
    } catch {
      return res.status(401).json({ error: "Invalid or expired Firebase token." });
    }

    const firebaseUid = decoded.uid;
    const name        = (decoded.name as string | undefined) || "";

    await connectMongo();

    // ── Phone auth ──────────────────────────────────────────────────────────
    if (provider === "phone") {
      const phoneNumber = (decoded as any).phone_number as string | undefined;
      if (!phoneNumber) {
        return res.status(400).json({ error: "No phone number in token." });
      }

      let user = await User.findOne({
        $or: [{ phoneId: firebaseUid }, { phoneNumber }],
      });
      let isNewAccount = false;

      if (user) {
        const resolved = await resolveRequestedRole(user, requestedRole);
        const judgeCanUseSeeker = requestedRole === "seeker" && isJudgeReviewerEmail(user.email);
        if (resolved.mismatch && !judgeCanUseSeeker) {
          return res.status(409).json({
            code: "ROLE_MISMATCH",
            error: `This account is registered as a ${resolved.role === "seeker" ? "job seeker" : "job creator"}. Please use the ${resolved.role === "seeker" ? "job seeker" : "job creator"} sign-in.`,
          });
        }
        let changed = false;
        if (!user.phoneId)      { user.phoneId = firebaseUid; changed = true; }
        if (!user.phoneNumber)  { user.phoneNumber = phoneNumber; changed = true; }
        if (!user.isVerified)   { user.isVerified = true; changed = true; }
        if (changed) await user.save();
      } else {
        isNewAccount = true;
        user = await createUserWithBillingEntitlements({
          passwordHash: "",
          name,
          isVerified:   true,
          phoneNumber,
          phoneId:      firebaseUid,
          signupRole:   requestedRole ?? "creator",
        });
      }

      await finalizeJudgeReviewerAccess(user);
      const token = signToken({ sub: user._id.toString(), email: user.email || user.phoneNumber || firebaseUid });
      return res.json({
        token,
        isNewAccount,
        user: { ...userPublicDto(user), phoneNumber: user.phoneNumber },
      });
    }

    // ── Google auth ─────────────────────────────────────────────────────────
    const email = decoded.email?.trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: "No email in token. Ensure the provider shares an email." });
    }

    const idField = "googleId";
    let user = await User.findOne({
      $or: [{ [idField]: firebaseUid }, { email }],
    });
    let isNewAccount = false;

    if (user) {
      const resolved = await resolveRequestedRole(user, requestedRole);
      const judgeCanUseSeeker = requestedRole === "seeker" && isJudgeReviewerEmail(user.email);
      if (resolved.mismatch && !judgeCanUseSeeker) {
        return res.status(409).json({
          code: "ROLE_MISMATCH",
          error: `This account is registered as a ${resolved.role === "seeker" ? "job seeker" : "job creator"}. Please use the ${resolved.role === "seeker" ? "job seeker" : "job creator"} sign-in.`,
        });
      }
      let changed = false;
      if (!(user as any)[idField]) { (user as any)[idField] = firebaseUid; changed = true; }
      if (!user.isVerified)        { user.isVerified = true;               changed = true; }
      if (!user.name && name)      { user.name = name;                     changed = true; }
      if (changed) await user.save();
    } else {
      isNewAccount = true;
      user = await createUserWithBillingEntitlements({
        email,
        passwordHash: "",
        name,
        isVerified:   true,
        [idField]:    firebaseUid,
        signupRole:   requestedRole ?? "creator",
      });
    }

    await finalizeJudgeReviewerAccess(user);
    const token = signToken({ sub: user._id.toString(), email: user.email! });
    return res.json({
      token,
      isNewAccount,
      user: userPublicDto(user),
    });
  } catch (err: any) {
    console.error("[auth/social] error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── GET /auth/github — initiate GitHub OAuth ─────────────────────────────────

authRouter.get("/github", (_req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(500).send("GitHub OAuth is not configured (missing GITHUB_CLIENT_ID).");
  }
  const target = getGitHubTarget(_req.query.target);
  const intent = getGitHubIntent(_req.query.intent);
  const redirectUri = `${BACKEND_URL}/auth/github/callback?target=${encodeURIComponent(target)}&intent=${encodeURIComponent(intent)}`;
  // Use a short-lived signed JWT as the state — provides CSRF protection without a session store
  const state = signToken({ sub: "oauth-state", email: `gh-${crypto.randomBytes(8).toString("hex")}` });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "user:email",
    state,
  });
  return res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// ─── GET /auth/github/callback ────────────────────────────────────────────────

authRouter.get("/github/callback", async (req, res) => {
  const { code, state, error: ghError } = req.query as {
    code?: string; state?: string; error?: string;
  };
  const target = getGitHubTarget(req.query.target);
  const intent = getGitHubIntent(req.query.intent);

  if (ghError) {
    return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "github_denied" }));
  }

  // Verify CSRF state
  if (!state || !verifyToken(state)) {
    return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "invalid_state" }));
  }

  if (!code) {
    return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "no_code" }));
  }

  const clientId     = process.env.GITHUB_CLIENT_ID     || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET || "";

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${BACKEND_URL}/auth/github/callback?target=${encodeURIComponent(target)}&intent=${encodeURIComponent(intent)}`,
      }),
    });
    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData?.access_token;

    if (!accessToken) {
      console.error("[auth/github] No access_token in response:", tokenData);
      return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "github_token_failed" }));
    }

    // Fetch GitHub user profile + emails in parallel
    const ghHeaders = {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent":  "Rolebolt/1.0",
      Accept:        "application/vnd.github+json",
    };

    const [userRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user",        { headers: ghHeaders }),
      fetch("https://api.github.com/user/emails", { headers: ghHeaders }),
    ]);

    const githubUser: any  = await userRes.json();
    const emailList: any[] = emailsRes.ok ? await emailsRes.json() : [];

    // Pick the best email: primary + verified > any verified > profile email
    let email: string | null = null;
    if (Array.isArray(emailList) && emailList.length > 0) {
      const primary  = emailList.find((e) => e.primary && e.verified);
      const verified = emailList.find((e) => e.verified);
      email = (primary ?? verified ?? emailList[0])?.email ?? null;
    }
    if (!email && githubUser.email) email = githubUser.email;

    if (!email) {
      return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "no_github_email" }));
    }

    email = email.trim().toLowerCase();
    await connectMongo();

    // Find user by githubId first, then by email (to link existing accounts)
    let user = await User.findOne({
      $or: [{ githubId: String(githubUser.id) }, { email }],
    });
    let isNewAccount = false;
    const requestedSignupRole: SignupRole = target === "seeker" ? "seeker" : "creator";

    if (user) {
      const resolved = await resolveRequestedRole(user, requestedSignupRole);
      if (resolved.mismatch) {
        return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "role_mismatch" }));
      }
      // Link githubId to existing account if not already set
      let changed = false;
      if (!user.githubId) { user.githubId = String(githubUser.id); changed = true; }
      if (!user.isVerified) { user.isVerified = true; changed = true; }
      if (changed) await user.save();
    } else {
      // Create new account — no password, already verified via GitHub
      isNewAccount = true;
      user = await createUserWithBillingEntitlements({
        email,
        passwordHash:  "",
        name:          (githubUser.name || githubUser.login || "").trim(),
        isVerified:    true,
        githubId:      String(githubUser.id),
        signupRole:    requestedSignupRole,
      });
    }

    await finalizeJudgeReviewerAccess(user);
    const jwt = signToken({ sub: user._id.toString(), email: user.email });

    return res.redirect(buildGitHubFrontendCallback(target, intent, {
      token: jwt,
      created: isNewAccount ? "1" : "0",
    }));
  } catch (err: any) {
    console.error("[auth/github] callback error:", err?.message);
    return res.redirect(buildGitHubFrontendCallback(target, intent, { error: "github_failed" }));
  }
});

// ─── GET /auth/check-username ─────────────────────────────────────────────────

authRouter.get("/check-username", async (req, res) => {
  try {
    await connectMongo();
    const parsed = validateUsername(req.query.username);
    if ("error" in parsed) {
      return res.json({ available: false, error: parsed.error });
    }
    const taken = await User.findOne({ username: parsed.username }).select("_id").lean();
    return res.json({ available: !taken, username: parsed.username });
  } catch (err: any) {
    console.error("[auth] check-username error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── PATCH /auth/username — complete username onboarding ─────────────────────
//
// Social accounts are created without a username because the provider's
// display name is not a stable, unique public handle. A username can only be
// assigned once, and the same validation is enforced again on the server.
authRouter.patch("/username", requireAuth, async (req, res) => {
  try {
    await connectMongo();

    const uid = (req as any).user?.uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const parsed = validateUsername(req.body?.username);
    if ("error" in parsed) return res.status(400).json({ error: parsed.error });

    const user = await User.findById(uid);
    if (!user) return res.status(404).json({ error: "User not found." });

    // This endpoint completes onboarding; it must not become an accidental
    // username-change endpoint later.
    if (user.username) {
      if (user.username === parsed.username) return res.json({ user: userPublicDto(user) });
      return res.status(409).json({ error: "Your username has already been set." });
    }

    const taken = await User.findOne({
      username: parsed.username,
      _id: { $ne: user._id },
    }).select("_id").lean();
    if (taken) return res.status(409).json({ error: "This username is already taken." });

    user.username = parsed.username;
    await user.save();

    // Keep the role-specific profile records aligned with the auth user. This
    // makes all existing and future profile consumers use one canonical handle.
    await Promise.all([
      RecruitProfile.updateOne({ uid }, { $set: { username: parsed.username } }),
      RecruitSeekerProfile.updateOne({ uid }, { $set: { username: parsed.username } }),
    ]);

    return res.json({ user: userPublicDto(user) });
  } catch (err: any) {
    if (err?.code === 11000 && err?.keyPattern?.username) {
      return res.status(409).json({ error: "This username is already taken." });
    }
    console.error("[auth] username onboarding error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/signup ────────────────────────────────────────────────────────

authRouter.post("/signup", async (req, res) => {
  try {
    await connectMongo();
    const requireEmailVerification = await emailVerificationIsRequired();

    const { email, password, username, role } = req.body as {
      email?: string;
      password?: string;
      username?: string;
      role?: string;
    };
    const signupRole = parseSignupRole(role);
    if (!signupRole) return res.status(400).json({ error: "Invalid signup role." });

    const usernameResult = validateUsername(username);
    if ("error" in usernameResult) return res.status(400).json({ error: usernameResult.error });

    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });
    if (!password)       return res.status(400).json({ error: "Password is required." });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = usernameResult.username;

    const existingUsername = await User.findOne({ username: normalizedUsername });
    if (existingUsername) {
      return res.status(400).json({ error: "This username is already taken." });
    }

    // Check for existing account
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (!existing.isVerified) {
        if (!requireEmailVerification) {
          const existingRole = await getStoredSignupRole(existing) ?? signupRole;
          if (!existing.signupRole) existing.signupRole = existingRole;
          existing.isVerified = true;
          existing.verificationToken = undefined;
          existing.verificationTokenExpiry = undefined;
          await existing.save();
          await finalizeJudgeReviewerAccess(existing);
          const token = signToken({ sub: existing._id.toString(), email: existing.email });
          return res.status(200).json({
            message: "Your account is active. Email verification is currently disabled.",
            verificationRequired: false,
            token,
            user: userPublicDto(existing),
          });
        }
        // Resend verification instead of erroring out
        const token = makeVerificationToken();
        const existingRole = await getStoredSignupRole(existing) ?? signupRole;
        if (!existing.signupRole) existing.signupRole = existingRole;
        existing.verificationToken       = token;
        existing.verificationTokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
        await existing.save();
        await sendVerificationEmail(normalizedEmail, existing.username || existing.name, token, existingRole);
        return res.status(400).json({
          code:  "EMAIL_NOT_VERIFIED",
          error: "An account with this email exists but hasn't been verified. We've sent a new verification link.",
        });
      }
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = makeVerificationToken();

    const user = await createUserWithBillingEntitlements({
      email:                   normalizedEmail,
      username:                normalizedUsername,
      passwordHash,
      name:                    "",
      signupRole,
      isVerified:              !requireEmailVerification,
      ...(requireEmailVerification
        ? {
            verificationToken,
            verificationTokenExpiry: new Date(Date.now() + TOKEN_TTL_MS),
          }
        : {}),
    });

    if (requireEmailVerification) {
      // Fire-and-forget — don't block the response on email delivery
      sendVerificationEmail(normalizedEmail, user.username || user.name, verificationToken, signupRole).catch((err) => {
        console.error("[auth] Failed to send verification email:", err?.message);
      });
    }

    if (!requireEmailVerification) {
      await finalizeJudgeReviewerAccess(user);
      const token = signToken({ sub: user._id.toString(), email: user.email });
      return res.status(201).json({
        message: "Account created. Your account is active.",
        verificationRequired: false,
        token,
        user: userPublicDto(user),
      });
    }

    return res.status(201).json({
      message: "Account created. Please check your email to verify your account.",
      verificationRequired: true,
      username: user.username,
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern ?? {})[0];
      if (field === "username") return res.status(400).json({ error: "This username is already taken." });
      if (field === "email") return res.status(400).json({ error: "An account with this email already exists." });
    }
    console.error("[auth] signup error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

authRouter.post("/login", async (req, res) => {
  try {
    await connectMongo();

    const { email, username, password, role } = req.body as {
      email?: string;
      username?: string;
      password?: string;
      role?: string;
    };
    if (role !== undefined && !parseRequestedRole(role)) {
      return res.status(400).json({ error: "Invalid account role." });
    }
    const requestedRole = parseRequestedRole(role);

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    const hasEmail = !!email?.trim();
    const hasUsername = !!username?.trim();

    if (hasEmail === hasUsername) {
      return res.status(400).json({ error: "Provide either email or username to sign in." });
    }

    let user = null;
    let invalidMessage = "Invalid credentials.";

    if (hasEmail) {
      invalidMessage = "Invalid email or password.";
      user = await User.findOne({ email: email!.trim().toLowerCase() });
    } else {
      invalidMessage = "Invalid username or password.";
      const parsed = validateUsername(username);
      if ("error" in parsed) return res.status(400).json({ error: parsed.error });
      user = await User.findOne({ username: parsed.username });
    }

    if (!user) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
      return res.status(401).json({ error: invalidMessage });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: invalidMessage });

    const requireEmailVerification = await emailVerificationIsRequired();
    if (!requireEmailVerification && !user.isVerified) {
      user.isVerified = true;
      user.verificationToken = undefined;
      user.verificationTokenExpiry = undefined;
      await user.save();
    }
    if (requireEmailVerification && !user.isVerified) {
      return res.status(403).json({
        code:  "EMAIL_NOT_VERIFIED",
        error: "Please verify your email before signing in. Check your inbox for a verification link.",
        email: user.email,
      });
    }

    const resolvedRole = await resolveRequestedRole(user, requestedRole);
    const judgeCanUseSeeker = requestedRole === "seeker" && isJudgeReviewerEmail(user.email);
    if (resolvedRole.mismatch && !judgeCanUseSeeker) {
      return res.status(409).json({
        code: "ROLE_MISMATCH",
        error: `This account is registered as a ${resolvedRole.role === "seeker" ? "job seeker" : "job creator"}. Please use the ${resolvedRole.role === "seeker" ? "job seeker" : "job creator"} sign-in.`,
      });
    }

    const token = signToken({ sub: user._id.toString(), email: user.email });

    await finalizeJudgeReviewerAccess(user);

    return res.json({
      token,
      user: userPublicDto(user),
    });
  } catch (err: any) {
    console.error("[auth] login error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/verify-email ──────────────────────────────────────────────────

authRouter.post("/verify-email", async (req, res) => {
  try {
    await connectMongo();

    const { token } = req.body as { token?: string };
    if (!token?.trim()) return res.status(400).json({ error: "Verification token is required." });

    const user = await User.findOne({ verificationToken: token.trim() });
    if (!user) return res.status(400).json({ error: "Invalid or expired verification link." });

    if (user.verificationTokenExpiry && user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({
        code:  "TOKEN_EXPIRED",
        error: "This verification link has expired. Please request a new one.",
      });
    }

    user.isVerified              = true;
    user.verificationToken       = undefined;
    user.verificationTokenExpiry = undefined;
    await user.save();

    const role = await getStoredSignupRole(user) ?? "creator";
    return res.json({ message: "Email verified successfully. You can now sign in.", role });
  } catch (err: any) {
    console.error("[auth] verify-email error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/resend-verification ──────────────────────────────────────────

authRouter.post("/resend-verification", async (req, res) => {
  try {
    await connectMongo();

    const { email, role: requestedRole } = req.body as { email?: string; role?: string };
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Always return success to prevent enumeration
    if (!user || user.isVerified) {
      return res.json({ message: "If that email exists and is unverified, a new link has been sent." });
    }

    const requestedSignupRole = parseSignupRole(requestedRole);
    if (!requestedSignupRole) return res.status(400).json({ error: "Invalid signup role." });
    const verificationRole = await getStoredSignupRole(user) ?? requestedSignupRole;
    if (!user.signupRole) user.signupRole = verificationRole;
    const token = makeVerificationToken();
    user.verificationToken       = token;
    user.verificationTokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
    await user.save();

    sendVerificationEmail(user.email, user.name, token, verificationRole).catch((err) => {
      console.error("[auth] Failed to resend verification email:", err?.message);
    });

    return res.json({ message: "If that email exists and is unverified, a new link has been sent." });
  } catch (err: any) {
    console.error("[auth] resend-verification error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

authRouter.post("/forgot-password", async (req, res) => {
  try {
    await connectMongo();

    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Always return success — prevents email enumeration
    if (!user || !user.isVerified) {
      return res.json({ message: "If that email is registered, a reset link has been sent." });
    }

    const resetToken = makeToken();
    user.resetToken        = resetToken;
    user.resetTokenExpiry  = new Date(Date.now() + RESET_TTL_MS);
    await user.save();

    const link = `${FRONTEND_URL}/recruit/reset-password?token=${resetToken}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#0a66c2;padding:28px 36px;text-align:center;">
              <span style="display:inline-block;background:#ffffff;border-radius:12px;padding:8px 14px;">
                <span style="font-size:18px;font-weight:900;color:#0a66c2;letter-spacing:-0.5px;">Rolebolt</span>
              </span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 28px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:800;color:#0f172a;line-height:1.2;">
                Reset your password
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
                ${user.name ? `Hi ${user.name},` : "Hi,"} we received a request to reset the password for your Rolebolt account. Click the button below to choose a new password.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
                <tr>
                  <td style="border-radius:12px;background:#0a66c2;box-shadow:0 4px 14px rgba(10,102,194,0.35);">
                    <a href="${link}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:-0.1px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;line-height:1.6;">
                Or copy this link into your browser:
              </p>
              <p style="margin:0 0 28px;font-size:12px;color:#0a66c2;word-break:break-all;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
                ${link}
              </p>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;">
                This link expires in <strong style="color:#64748b;">1 hour</strong> and can only be used once. If you didn't request a password reset, you can safely ignore this email — your password will not change.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #f1f5f9;padding:20px 36px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © 2026 Rolebolt · <a href="https://rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const text = `Hi${user.name ? ` ${user.name}` : ""},\n\nWe received a request to reset your Rolebolt password.\n\nReset your password here:\n${link}\n\nThis link expires in 1 hour and can only be used once.\n\nIf you didn't request this, you can safely ignore this email.`;

    sendEmail({
      to:      normalizedEmail,
      subject: "Reset your Rolebolt password",
      html,
      text,
      from:    AUTH_FROM,
    }).catch((err) => {
      console.error("[auth] Failed to send reset email:", err?.message);
    });

    return res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err: any) {
    console.error("[auth] forgot-password error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

authRouter.post("/reset-password", async (req, res) => {
  try {
    await connectMongo();

    const { token, password } = req.body as { token?: string; password?: string };

    if (!token?.trim())
      return res.status(400).json({ code: "TOKEN_INVALID", error: "Reset token is required." });
    if (!password)
      return res.status(400).json({ error: "Password is required." });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });

    const user = await User.findOne({ resetToken: token.trim() });
    if (!user) {
      return res.status(400).json({ code: "TOKEN_INVALID", error: "Invalid or expired reset link." });
    }

    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      // Clean up expired token
      user.resetToken       = undefined;
      user.resetTokenExpiry = undefined;
      await user.save();
      return res.status(400).json({ code: "TOKEN_EXPIRED", error: "This reset link has expired. Please request a new one." });
    }

    // Hash new password and clear the reset token (one-time use)
    user.passwordHash     = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.resetToken       = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    return res.json({ message: "Password updated successfully. You can now sign in with your new password." });
  } catch (err: any) {
    console.error("[auth] reset-password error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    await connectMongo();

    const uid = (req as any).user?.uid;
    const user = await User.findById(uid).select("-passwordHash -verificationToken -verificationTokenExpiry");
    if (!user) return res.status(404).json({ error: "User not found." });

    await finalizeJudgeReviewerAccess(user);

    return res.json({
      id:         user._id.toString(),
      email:      user.email,
      username:   user.username ?? "",
      name:       user.name,
      isVerified: user.isVerified,
      signupRole: user.signupRole,
    });
  } catch (err: any) {
    console.error("[auth] /me error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});
