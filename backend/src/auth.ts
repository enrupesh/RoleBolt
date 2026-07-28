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
import { signToken, requireAuth } from "./authMiddleware";
import { sendEmail } from "./mailer";

export const authRouter = express.Router();

// ─── Config ───────────────────────────────────────────────────────────────────

const FRONTEND_URL  = (process.env.FRONTEND_URL || "https://www.rolebolt.tech").replace(/\/$/, "");
const FROM_NAME     = process.env.SMTP_FROM_NAME  || "Rolebolt";
const FROM_EMAIL    = process.env.SMTP_FROM_EMAIL || "verify@rolebolt.tech";

const BCRYPT_ROUNDS    = 12;
const TOKEN_TTL_MS     = 24 * 60 * 60 * 1000;       // 24 h  (email verification)
const RESET_TTL_MS     =  1 * 60 * 60 * 1000;       //  1 h  (password reset)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** @deprecated use makeToken() */
function makeVerificationToken(): string { return makeToken(); }

async function sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
  const link = `${FRONTEND_URL}/recruit/verify-email?token=${token}`;

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
                © 2025 Rolebolt · <a href="https://rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
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

  await sendEmail({ to: email, subject: "Verify your Rolebolt account", html, text, from: `${FROM_NAME} <${FROM_EMAIL}>` });
}

// ─── POST /auth/signup ────────────────────────────────────────────────────────

authRouter.post("/signup", async (req, res) => {
  try {
    await connectMongo();

    const { email, password, name } = req.body as {
      email?: string;
      password?: string;
      name?: string;
    };

    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });
    if (!password)       return res.status(400).json({ error: "Password is required." });
    if (password.length < 8)
      return res.status(400).json({ error: "Password must be at least 8 characters." });

    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing account
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      if (!existing.isVerified) {
        // Resend verification instead of erroring out
        const token = makeVerificationToken();
        existing.verificationToken       = token;
        existing.verificationTokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
        await existing.save();
        await sendVerificationEmail(normalizedEmail, existing.name, token);
        return res.status(400).json({
          code:  "EMAIL_NOT_VERIFIED",
          error: "An account with this email exists but hasn't been verified. We've sent a new verification link.",
        });
      }
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const verificationToken = makeVerificationToken();

    const user = await User.create({
      email:                   normalizedEmail,
      passwordHash,
      name:                    name?.trim() ?? "",
      isVerified:              false,
      verificationToken,
      verificationTokenExpiry: new Date(Date.now() + TOKEN_TTL_MS),
    });

    // Fire-and-forget — don't block the response on email delivery
    sendVerificationEmail(normalizedEmail, user.name, verificationToken).catch((err) => {
      console.error("[auth] Failed to send verification email:", err?.message);
    });

    return res.status(201).json({
      message: "Account created. Please check your email to verify your account.",
    });
  } catch (err: any) {
    console.error("[auth] signup error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

authRouter.post("/login", async (req, res) => {
  try {
    await connectMongo();

    const { email, password } = req.body as { email?: string; password?: string };

    if (!email?.trim() || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      // Constant-time response to prevent user enumeration
      await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid email or password." });

    if (!user.isVerified) {
      return res.status(403).json({
        code:  "EMAIL_NOT_VERIFIED",
        error: "Please verify your email before signing in. Check your inbox for a verification link.",
      });
    }

    const token = signToken({ sub: user._id.toString(), email: user.email });

    return res.json({
      token,
      user: {
        id:    user._id.toString(),
        email: user.email,
        name:  user.name,
      },
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

    return res.json({ message: "Email verified successfully. You can now sign in." });
  } catch (err: any) {
    console.error("[auth] verify-email error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ─── POST /auth/resend-verification ──────────────────────────────────────────

authRouter.post("/resend-verification", async (req, res) => {
  try {
    await connectMongo();

    const { email } = req.body as { email?: string };
    if (!email?.trim()) return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    // Always return success to prevent enumeration
    if (!user || user.isVerified) {
      return res.json({ message: "If that email exists and is unverified, a new link has been sent." });
    }

    const token = makeVerificationToken();
    user.verificationToken       = token;
    user.verificationTokenExpiry = new Date(Date.now() + TOKEN_TTL_MS);
    await user.save();

    sendVerificationEmail(user.email, user.name, token).catch((err) => {
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
                © 2025 Rolebolt · <a href="https://rolebolt.tech" style="color:#94a3b8;text-decoration:none;">rolebolt.tech</a>
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
      from:    `${FROM_NAME} <${FROM_EMAIL}>`,
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

    return res.json({
      id:         user._id.toString(),
      email:      user.email,
      name:       user.name,
      isVerified: user.isVerified,
    });
  } catch (err: any) {
    console.error("[auth] /me error:", err?.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});
