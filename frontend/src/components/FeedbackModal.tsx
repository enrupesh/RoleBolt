"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiUrl, readApiJson } from "@/lib/api";

function ExternalArrow() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17 17 7" />
      <path d="M7 7h10v10" />
    </svg>
  );
}

const feedbackCategories = [
  { value: "product", label: "Product experience" },
  { value: "bug", label: "Report a bug" },
  { value: "feature", label: "Feature request" },
  { value: "recruiter", label: "Recruiter workspace" },
  { value: "job_seeker", label: "Job seeker experience" },
  { value: "billing", label: "Billing & plans" },
  { value: "other", label: "Something else" },
] as const;

export function FeedbackModal({
  onClose,
  initialCategory = "product",
}: {
  onClose: () => void;
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (message.trim().length < 10) {
      setError("Please share at least a little detail so we can act on it.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(apiUrl("/recruit-public/feedback"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          email: email.trim() || undefined,
          pageUrl: window.location.href,
        }),
      });
      const data = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(data.error || "We couldn't save your feedback.");
      setSubmitted(true);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save your feedback.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061522]/75 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#102b43] text-white shadow-[0_30px_100px_rgba(0,0,0,.4)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-6 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74d8ba]">We&apos;re listening</p>
            <h2 id="feedback-modal-title" className="mt-2 font-display text-2xl font-semibold tracking-[-0.04em]">Tell us what you think</h2>
            <p className="mt-1.5 text-sm leading-5 text-[#a9c5d8]">Your feedback goes directly to the Rolebolt team.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close feedback form" className="rounded-xl p-2 text-[#9eb5c8] transition hover:bg-white/10 hover:text-white">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {submitted ? (
            <div className="px-6 py-12 text-center sm:px-7">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#41d2a0]/15 text-[#73e2bd]">
                <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
              </div>
              <h3 className="mt-5 text-xl font-semibold">Thank you for sharing.</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#a9c5d8]">Your feedback has been sent to our admin inbox. We appreciate you helping us make Rolebolt better.</p>
              <button type="button" onClick={onClose} className="mt-7 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-[#102d46] transition hover:bg-[#e8f4fb]">Done</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5 px-6 py-6 sm:px-7">
              <div>
                <label htmlFor="feedback-category" className="text-xs font-semibold text-[#d7e7f1]">What is this about?</label>
                <select id="feedback-category" value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a2135] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#5fd4b0]">
                  {feedbackCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="feedback-message" className="text-xs font-semibold text-[#d7e7f1]">Your feedback</label>
                <textarea id="feedback-message" required minLength={10} maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="What is working well? What could be clearer? What should we build next?" className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0a2135] px-3.5 py-3 text-sm leading-6 text-white outline-none placeholder:text-[#6f8ba0] transition focus:border-[#5fd4b0]" />
                <div className="mt-1 text-right text-[11px] text-[#7693a8]">{message.length}/5,000</div>
              </div>
              <div>
                <label htmlFor="feedback-email" className="text-xs font-semibold text-[#d7e7f1]">Email <span className="font-normal text-[#7895aa]">(optional)</span></label>
                <input id="feedback-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0a2135] px-3.5 py-3 text-sm text-white outline-none placeholder:text-[#6f8ba0] transition focus:border-[#5fd4b0]" />
                <p className="mt-1.5 text-[11px] text-[#7895aa]">Only add it if you would like us to follow up.</p>
              </div>
              {error && <p className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2.5 text-xs text-red-200">{error}</p>}
              <div className="flex flex-col-reverse gap-2.5 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-[#a9c5d8] transition hover:bg-white/10 hover:text-white">Cancel</button>
                <button type="submit" disabled={busy || message.trim().length < 10} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#41d2a0] px-5 py-2.5 text-sm font-semibold text-[#062b2a] transition hover:bg-[#73e2bd] disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? "Sending…" : "Send feedback"}
                  {!busy && <ExternalArrow />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}