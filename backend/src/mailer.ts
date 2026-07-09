import * as Brevo from "@getbrevo/brevo";

const BREVO_API_KEY   = process.env.BREVO_API_KEY   || "";
const SMTP_FROM_NAME  = process.env.SMTP_FROM_NAME  || "ForJob Hiring";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "";

let _api: Brevo.TransactionalEmailsApi | null = null;

function getApi(): Brevo.TransactionalEmailsApi | null {
  if (!BREVO_API_KEY) return null;
  if (!_api) {
    _api = new Brevo.TransactionalEmailsApi();
    _api.setApiKey(Brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);
  }
  return _api;
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

  if (!SMTP_FROM_EMAIL) {
    console.warn("[mailer] SMTP_FROM_EMAIL not set — skipping email");
    return { ok: false, error: "email_not_configured" };
  }

  const api = getApi();
  if (!api) {
    console.warn("[mailer] BREVO_API_KEY not set — skipped (to:", opts.to, ")");
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const mail = new Brevo.SendSmtpEmail();
    mail.sender      = { name: SMTP_FROM_NAME, email: SMTP_FROM_EMAIL };
    mail.to          = [{ email: opts.to.trim() }];
    mail.subject     = opts.subject;
    mail.htmlContent = opts.html;
    if (opts.text) mail.textContent = opts.text;

    await api.sendTransacEmail(mail);
    console.log("[mailer] Sent:", opts.subject, "→", opts.to);
    return { ok: true };
  } catch (err: any) {
    const msg: string = err?.response?.text || err?.message || String(err);
    console.error("[mailer] sendEmail failed:", msg);
    return { ok: false, error: msg };
  }
}

export function isConfigured(): boolean {
  return Boolean(BREVO_API_KEY && SMTP_FROM_EMAIL);
}

/**
 * Diagnostic: checks if Brevo API key is valid by fetching account info.
 * Does NOT send any email.
 */
export async function verifySMTP(): Promise<{ ok: boolean; message: string }> {
  if (!BREVO_API_KEY) {
    return { ok: false, message: "BREVO_API_KEY not set — email is not configured." };
  }
  if (!SMTP_FROM_EMAIL) {
    return { ok: false, message: "SMTP_FROM_EMAIL not set — set this to your verified Brevo sender email." };
  }

  try {
    const accountApi = new Brevo.AccountApi();
    accountApi.setApiKey(Brevo.AccountApiApiKeys.apiKey, BREVO_API_KEY);
    const { body } = await accountApi.getAccount();
    return {
      ok: true,
      message: `Brevo API key valid. Account: ${(body as any).email || "connected"}. Emails will be sent from ${SMTP_FROM_EMAIL}.`,
    };
  } catch (err: any) {
    const msg: string = err?.response?.text || err?.message || String(err);
    return { ok: false, message: `Brevo verify failed: ${msg}` };
  }
}
