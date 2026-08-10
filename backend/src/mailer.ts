import { Resend } from "resend";
import { DEFAULT_FROM } from "./emailConfig";

const RESEND_API_KEY   = process.env.RESEND_API_KEY   || "";

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
  /** Override the default sender. Pass a full "Name <email>" string. */
  from?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!opts.to?.trim()) {
    console.warn("[mailer] No recipient — skipping");
    return { ok: false, error: "no_recipient" };
  }

  const client = getClient();
  if (!client) {
    console.warn("[mailer] RESEND_API_KEY not set — skipped (to:", opts.to, ")");
    return { ok: false, error: "smtp_not_configured" };
  }

  try {
    const { error } = await client.emails.send({
      from: opts.from ?? DEFAULT_FROM,
      to:   [opts.to.trim()],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) {
      console.error("[mailer] Resend error:", error.message);
      return { ok: false, error: error.message };
    }

    console.log("[mailer] Sent:", opts.subject);
    return { ok: true };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error("[mailer] sendEmail failed:", msg);
    return { ok: false, error: msg };
  }
}

export function isConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

export async function verifySMTP(): Promise<{ ok: boolean; message: string }> {
  if (!RESEND_API_KEY) {
    return { ok: false, message: "RESEND_API_KEY not set." };
  }
  try {
    const client = new Resend(RESEND_API_KEY);
    const { data, error } = await client.domains.list();
    if (error) return { ok: false, message: `Resend API error: ${error.message}` };
    const domains = (data as any)?.data ?? data ?? [];
    const verified = Array.isArray(domains) && domains.length > 0
      ? `Domains: ${domains.map((d: any) => d.name).join(", ")}`
      : "No domains found";
    return { ok: true, message: `Resend OK — ${verified}` };
  } catch (err: any) {
    return { ok: false, message: `Resend verify failed: ${err?.message || err}` };
  }
}
