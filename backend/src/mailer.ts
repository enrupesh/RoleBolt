import nodemailer from "nodemailer";

const SMTP_HOST       = process.env.SMTP_HOST       || "smtp.gmail.com";
const SMTP_PORT       = Number(process.env.SMTP_PORT || 587);
const SMTP_USER       = process.env.SMTP_USER       || "";
const SMTP_PASS       = process.env.SMTP_PASS       || "";
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || "ForJob Hiring";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;

// Per-call send timeout (ms). The transporter-level timeouts must all be
// shorter than this so nodemailer always rejects before the Promise.race fires.
const SEND_TIMEOUT_MS = 30_000;

// Nodemailer connection/socket timeouts — kept well under SEND_TIMEOUT_MS
// so we get a descriptive nodemailer error rather than a generic timeout.
const NM_CONNECTION_TIMEOUT = 20_000; // TCP connect
const NM_GREETING_TIMEOUT   = 15_000; // SMTP greeting
const NM_SOCKET_TIMEOUT     = 25_000; // idle socket

// Singleton transporter — reset on connection/auth errors so the next call
// gets a fresh attempt instead of reusing a broken connection.
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
    tls: {
      // Render's egress IPs can trigger SNI/cert issues with some hosts;
      // still validate in production but log the warning instead of crashing.
      rejectUnauthorized: true,
    },
  });
}

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) return null;
  if (!_transporter) _transporter = buildTransporter();
  return _transporter;
}

function resetTransporter() {
  // Just null the reference — do NOT call .close() on the old transporter
  // because in-flight sendMail calls on it must be allowed to complete.
  _transporter = null;
}

// Returns true for errors that mean the transporter itself is broken and
// should be recreated on the next call (connection refused, auth failure, etc.)
function isTransientConnectionError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("econnreset") ||
    lower.includes("ssl") ||
    lower.includes("tls") ||
    lower.includes("auth") ||
    lower.includes("greeting")
  );
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

  const sendPromise = t.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: opts.to.trim(),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`SMTP send timed out after ${SEND_TIMEOUT_MS / 1000}s`)),
      SEND_TIMEOUT_MS
    )
  );

  try {
    await Promise.race([sendPromise, timeoutPromise]);
    console.log("[mailer] Sent:", opts.subject, "→", opts.to);
    return { ok: true };
  } catch (err: any) {
    const msg: string = err?.message || String(err);
    console.error("[mailer] sendMail failed:", msg);

    // Reset the singleton so the next call gets a fresh connection attempt.
    if (isTransientConnectionError(msg)) {
      console.warn("[mailer] Resetting transporter due to connection/auth error.");
      resetTransporter();
    }

    return { ok: false, error: msg };
  }
}

export function isConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

/**
 * Diagnostic: verifies SMTP credentials by opening a connection and running
 * a NOOP command. Returns a summary string for the /health or /diagnostics route.
 */
export async function verifySMTP(): Promise<{ ok: boolean; message: string }> {
  if (!SMTP_USER || !SMTP_PASS) {
    return { ok: false, message: "SMTP not configured (SMTP_USER / SMTP_PASS missing)." };
  }
  const t = buildTransporter(); // always fresh for verify
  try {
    await Promise.race([
      t.verify(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SMTP verify timed out after 20s")), 20_000)
      ),
    ]);
    return { ok: true, message: `SMTP OK — credentials verified and connection accepted.` };
  } catch (err: any) {
    return { ok: false, message: `SMTP verify failed: ${err?.message || err}` };
  } finally {
    try { (t as any).close?.(); } catch {}
  }
}
