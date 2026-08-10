"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { billingHref, pricingHref, type BillingCategory } from "@/lib/billing";
import { useBillingEntitlements } from "@/contexts/BillingEntitlementContext";
import { PlanLimitModal } from "@/components/PlanLimitModal";
import {
  CREATOR_EMAIL_TEMPLATES,
  getCreatorEmailTemplate,
  type CreatorEmailTemplateKey,
} from "@/lib/creatorEmailTemplates";

export type CreatorEmailRecipient = {
  id: string;
  name: string;
  email: string;
};

type SendResult = {
  recipientId: string;
  email: string;
  status: "sent" | "failed";
  error?: string;
};

type CreatorEmailComposerProps = {
  open: boolean;
  onClose: () => void;
  channel: "standard" | "form";
  contextId: string;
  token: string;
  billingCategory: BillingCategory;
  initialRecipientIds: string[];
  recipientPool: CreatorEmailRecipient[];
  senderPreview?: { username?: string; email?: string; companyName?: string };
  onSent?: (results: SendResult[]) => void;
};

function MailIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

export function CreatorEmailComposer({
  open,
  onClose,
  channel,
  contextId,
  token,
  billingCategory,
  initialRecipientIds,
  recipientPool,
  senderPreview,
  onSent,
}: CreatorEmailComposerProps) {
  const { canUse } = useBillingEntitlements();
  const featureEnabled = canUse(billingCategory, "creatorEmailComposer");

  const [selectedIds, setSelectedIds] = useState<string[]>(initialRecipientIds);
  const [templateKey, setTemplateKey] = useState<CreatorEmailTemplateKey>("professional");
  const [subject, setSubject] = useState(getCreatorEmailTemplate("professional").subject);
  const [body, setBody] = useState(getCreatorEmailTemplate("professional").body);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [billingError, setBillingError] = useState<unknown>(null);
  const [successMessage, setSuccessMessage] = useState("");

  const recipientsWithEmail = useMemo(
    () => recipientPool.filter((item) => item.email?.trim()),
    [recipientPool],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedIds(initialRecipientIds.filter((id) => recipientsWithEmail.some((item) => item.id === id)));
    setError("");
    setBillingError(null);
    setSuccessMessage("");
  }, [open, initialRecipientIds, recipientsWithEmail]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function applyTemplate(key: CreatorEmailTemplateKey) {
    const template = getCreatorEmailTemplate(key);
    setTemplateKey(key);
    setSubject(template.subject);
    setBody(template.body);
  }

  function toggleRecipient(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  async function sendEmails() {
    if (!featureEnabled) {
      setBillingError({ error: "FEATURE_NOT_AVAILABLE", category: billingCategory, feature: "creatorEmailComposer", upgradeRequired: true });
      return;
    }
    if (selectedIds.length === 0) {
      setError("Select at least one recipient.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError("Subject and message are required.");
      return;
    }

    setSending(true);
    setError("");
    setBillingError(null);
    setSuccessMessage("");

    try {
      const res = await fetch(apiUrl("/recruit/creator-emails/send"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          channel,
          contextId,
          subject: subject.trim(),
          body: body.trim(),
          recipients: selectedIds.map((recipientId) => ({ recipientId })),
          idempotencyKey: `${contextId}:${Date.now()}`,
        }),
      });
      const data = await readApiJson(res);
      if (!res.ok) {
        if (data.error === "FEATURE_NOT_AVAILABLE" || data.error === "PLAN_LIMIT_REACHED") {
          setBillingError(data);
          return;
        }
        throw new Error(data.error || data.message || "Failed to send email.");
      }

      const results = (data.results || []) as SendResult[];
      onSent?.(results);
      const sentCount = Number(data.sent || 0);
      const failedCount = Number(data.failed || 0);
      if (failedCount > 0 && sentCount > 0) {
        setSuccessMessage(`Sent ${sentCount} email${sentCount === 1 ? "" : "s"}. ${failedCount} failed.`);
      } else if (sentCount > 0) {
        setSuccessMessage(`Successfully sent ${sentCount} email${sentCount === 1 ? "" : "s"}.`);
        window.setTimeout(() => onClose(), 900);
      } else {
        throw new Error("All emails failed to send.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const previewUsername = senderPreview?.username?.trim() || "your-username";
  const previewEmail = senderPreview?.email?.trim() || "you@company.com";
  const previewCompany = senderPreview?.companyName?.trim() || "Your company";

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          className="flex max-h-[calc(100dvh-2rem)] min-h-0 w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-950 via-[#132238] to-[#0a66c2] px-6 py-5 text-white">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
                <MailIcon />
                Creator Email
              </div>
              <h2 className="mt-3 text-xl font-bold tracking-tight">Send Email</h2>
              <p className="mt-1 text-sm text-white/70">
                Premium candidate outreach from <span className="font-semibold text-white">no-reply@jobcreators.rolebolt.tech</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/15 transition"
            >
              Close
            </button>
          </div>

          {!featureEnabled ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-slate-900">Pro or Ultra Pro required</p>
              <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
                Send branded candidate emails with premium templates and verified creator identity. Available on Pro and Ultra Pro plans.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={pricingHref(billingCategory)}
                  className="inline-flex rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition"
                >
                  View plans
                </Link>
                <Link
                  href={billingHref(billingCategory)}
                  className="inline-flex rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Billing
                </Link>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="border-b border-slate-100 bg-slate-50/70 p-5 lg:border-b-0 lg:border-r">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Recipients</p>
                <p className="mt-1 text-xs text-slate-500 mb-4">Select one or more candidates with an email on file.</p>
                <div className="space-y-2">
                  {recipientsWithEmail.length === 0 ? (
                    <p className="text-sm text-slate-500">No candidates with email addresses available.</p>
                  ) : (
                    recipientsWithEmail.map((recipient) => {
                      const checked = selectedIds.includes(recipient.id);
                      return (
                        <label
                          key={recipient.id}
                          className={`flex items-start gap-3 rounded-2xl border px-3 py-3 cursor-pointer transition ${
                            checked ? "border-[#0a66c2] bg-blue-50/70" : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecipient(recipient.id)}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900 truncate">{recipient.name}</span>
                            <span className="block text-xs text-slate-500 truncate">{recipient.email}</span>
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-3">Templates</p>
                  <div className="flex flex-wrap gap-2">
                    {CREATOR_EMAIL_TEMPLATES.map((template) => (
                      <button
                        key={template.key}
                        type="button"
                        onClick={() => applyTemplate(template.key)}
                        className={`rounded-full px-3.5 py-2 text-xs font-semibold border transition ${
                          templateKey === template.key
                            ? "border-[#0a66c2] bg-[#0a66c2] text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Subject</label>
                  <input
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10 transition"
                    placeholder="Email subject"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1.5">Message</label>
                  <textarea
                    value={body}
                    onChange={(event) => setBody(event.target.value)}
                    rows={10}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10 resize-y min-h-[220px] transition"
                    placeholder="Write your message to candidates…"
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-950 text-white">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/45">Live preview</p>
                    <p className="mt-1 text-sm font-semibold">{previewCompany}</p>
                  </div>
                  <div className="p-4 bg-white">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{body || "Your message will appear here."}</p>
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                      <p className="text-xs text-slate-500">
                        This email was sent through <strong className="text-slate-800">Rolebolt</strong>.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Sent by <strong className="text-slate-800">@{previewUsername}</strong>
                        <span className="text-slate-300"> · </span>
                        {previewEmail}
                      </p>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-slate-400">Permanent footer · cannot be edited</p>
                    </div>
                  </div>
                </div>

                {error && <p className="text-sm text-rose-600">{error}</p>}
                {successMessage && <p className="text-sm text-emerald-600">{successMessage}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={sendEmails}
                    disabled={sending || recipientsWithEmail.length === 0}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition disabled:opacity-60"
                  >
                    <MailIcon />
                    {sending ? "Sending…" : `Send Email${selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}`}
                  </button>
                </div>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <PlanLimitModal
        error={billingError}
        open={Boolean(billingError)}
        onClose={() => setBillingError(null)}
      />
    </>
  );
}
