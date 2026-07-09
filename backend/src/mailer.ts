import { Resend } from "resend";

const RESEND_API_KEY   = process.env.RESEND_API_KEY   || "";
const SMTP_FROM_NAME   = process.env.SMTP_FROM_NAME   || "ForJob Hiring";
const SMTP_FROM_EMAIL  = process.env.SMTP_FROM_EMAIL  || "onboarding@resend.dev";

let _client: Resend | null = null;

function getClient(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!_client) _client = new Resend(RESEND_API_KEY);
  return _client;
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

  const client = getClient();
  if (!client) {
    console.warn("[mailer] RESEND_API_KEY not set — skipped (to:", opts.to, ")");
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: `${SMTP_FROM_NAME} <${SMTP_FROM_EMAIL}>`,
      to: opts.to.trim(),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) {
      console.error("[mailer] Resend error:", error.message);
      return { ok: false, error: error.message };
    }

    console.log("[mailer] Sent:", opts.subject, "→", opts.to);
    return { ok: true };
  } catch (err: any) {
    const msg: string = err?.message || String(err);
    console.error("[mailer] sendEmail failed:", msg);
    return { ok: false, error: msg };
  }
}

export function isConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Diagnostic: verifies Resend API key is valid by fetching account domains.
 * Does NOT send any email.
 */
export async function verifySMTP(): Promise<{ ok: boolean; message: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY not set — email is not configured." };
  }

  const client = new Resend(RESEND_API_KEY);
  try {
    const { data, error } = await client.domains.list();
    if (error) return { ok: false, message: `Resend API key invalid: ${error.message}` };
    const domainCount = data?.data?.length ?? 0;
    return {
      ok: true,
      message: `Resend API key is valid. ${domainCount} domain(s) configured.`,
    };
  } catch (err: any) {
    return { ok: false, message: `Resend verify failed: ${err?.message || err}` };
  }
}
