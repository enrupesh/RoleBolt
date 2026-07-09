import nodemailer from "nodemailer";

const SMTP_HOST       = process.env.SMTP_HOST       || "smtp.gmail.com";
const SMTP_PORT       = Number(process.env.SMTP_PORT || 587);
const SMTP_USER       = process.env.SMTP_USER       || "";
const SMTP_PASS       = process.env.SMTP_PASS       || "";
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || "ForJob Hiring";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

const NM_CONNECTION_TIMEOUT = 20_000;
const NM_GREETING_TIMEOUT   = 15_000;
const NM_SOCKET_TIMEOUT     = 25_000;
const SEND_TIMEOUT_MS       = 30_000;

let _transporter: nodemailer.Transporter | null = null;

function buildTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: NM_CONNECTION_TIMEOUT,
    greetingTimeout:   NM_GREETING_TIMEOUT,
    socketTimeout:     NM_SOCKET_TIMEOUT,
    family: 4,          // force IPv4 — Render blocks IPv6 SMTP
  });
}

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!_transporter) _transporter = buildTransporter();
  return _transporter;
}

function resetTransporter() {
  _transporter = null;
}

function isTransientError(msg: string): boolean {
  const l = msg.toLowerCase();
  return (
    l.includes("timeout") || l.includes("econnrefused") ||
    l.includes("enotfound") || l.includes("econnreset") ||
    l.includes("ssl") || l.includes("tls") ||
    l.includes("auth") || l.includes("greeting")
  );
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!opts.to?.trim()) {
    console.warn("[mailer] No recipient — skipping");
    return { ok: false, error: "no_recipient" };
  }

  const t = getTransporter();
  if (!t) {
    console.warn("[mailer] SMTP not configured — skipped (to:", opts.to, ")");
    return { ok: false, error: "smtp_not_configured" };
  }

  const sendPromise = t.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: opts.to.trim(),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`SMTP timed out after ${SEND_TIMEOUT_MS / 1000}s`)), SEND_TIMEOUT_MS)
  );

  try {
    await Promise.race([sendPromise, timeoutPromise]);
    console.log("[mailer] Sent:", opts.subject, "→", opts.to);
    return { ok: true };
  } catch (err: any) {
    const msg: string = err?.message || String(err);
    console.error("[mailer] sendMail failed:", msg);
    if (isTransientError(msg)) resetTransporter();
    return { ok: false, error: msg };
  }
}

export function isConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

export async function verifySMTP(): Promise<{ ok: boolean; message: string }> {
  if (!SMTP_USER || !SMTP_PASS) {
    return { ok: false, message: "SMTP not configured (SMTP_USER / SMTP_PASS missing)." };
  }
  const t = buildTransporter();
  try {
    await Promise.race([
      t.verify(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timed out after 20s")), 20_000)
      ),
    ]);
    return { ok: true, message: "SMTP OK — credentials verified." };
  } catch (err: any) {
    return { ok: false, message: `SMTP verify failed: ${err?.message || err}` };
  } finally {
    try { (t as any).close?.(); } catch {}
  }
}
