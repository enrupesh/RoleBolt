import nodemailer from "nodemailer";

const SMTP_HOST     = process.env.SMTP_HOST     || "smtp.gmail.com";
const SMTP_PORT     = Number(process.env.SMTP_PORT || 587);
const SMTP_USER     = process.env.SMTP_USER     || "";
const SMTP_PASS     = process.env.SMTP_PASS     || "";
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || "ForJob Hiring";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return _transporter;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!opts.to?.trim()) {
    console.warn("[mailer] No recipient — skipping email");
    return { ok: false, error: "no_recipient" };
  }

  const t = getTransporter();
  if (!t) {
    console.warn("[mailer] SMTP not configured — skipped (to:", opts.to, ")");
    return { ok: false, error: "smtp_not_configured" };
  }

  try {
    await t.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: opts.to.trim(),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    console.log("[mailer] Sent:", opts.subject, "→", opts.to);
    return { ok: true };
  } catch (err: any) {
    console.error("[mailer] sendMail failed:", err.message);
    return { ok: false, error: err.message };
  }
}

export function isConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}
