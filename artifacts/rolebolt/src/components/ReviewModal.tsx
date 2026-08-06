"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

type Review = {
  id: string;
  rating: number;
  title: string;
  message: string;
  displayName: string;
  role: "creator" | "seeker";
};

const GUEST_EDIT_TOKEN_KEY = "rolebolt_guest_review_edit_token";

export function ReviewModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { sessionToken, authUser, recruitProfile } = useRecruitAuth();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState(authUser?.name || authUser?.username || "");
  const [role, setRole] = useState<"creator" | "seeker">(recruitProfile?.role || "seeker");
  const [existing, setExisting] = useState<Review | null>(null);
  const [allowGuestReviews, setAllowGuestReviews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [guestEditToken, setGuestEditToken] = useState("");

  const isRegistered = Boolean(sessionToken && recruitProfile);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const settingsResponse = await fetch(apiUrl("/recruit-public/reviews"), { cache: "no-store" });
        const settings = await readApiJson<{ allowGuestReviews?: boolean }>(settingsResponse);
        if (!cancelled) setAllowGuestReviews(Boolean(settings.allowGuestReviews));

        const savedGuestEditToken = !sessionToken ? window.localStorage.getItem(GUEST_EDIT_TOKEN_KEY) || "" : "";
        const meResponse = await fetch(apiUrl("/recruit-public/reviews/me"), {
          headers: {
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
            ...(savedGuestEditToken ? { "X-Review-Edit-Token": savedGuestEditToken } : {}),
          },
          cache: "no-store",
        });
        const me = await readApiJson<{ review?: Review | null }>(meResponse);
        if (!cancelled && me.review) {
          setExisting(me.review);
          setRating(me.review.rating);
          setTitle(me.review.title);
          setMessage(me.review.message);
          setDisplayName(me.review.displayName);
          if (!sessionToken) setGuestEditToken(savedGuestEditToken);
        }
      } catch {
        // The form remains usable; the server is the final source of truth for settings.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sessionToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!displayName.trim()) return setError("Please enter the name you want to show.");
    if (message.trim().length < 10) return setError("Please write at least 10 characters.");
    setBusy(true);
    try {
      const response = await fetch(apiUrl("/recruit-public/reviews"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        },
        body: JSON.stringify({
          rating,
          title: title.trim() || undefined,
          message: message.trim(),
          displayName: displayName.trim(),
          role: isRegistered ? undefined : role,
          editToken: !isRegistered ? guestEditToken || undefined : undefined,
        }),
      });
      const data = await readApiJson<{ error?: string; editToken?: string }>(response);
      if (!response.ok) throw new Error(data.error || "We couldn't save your review.");
      if (!isRegistered && data.editToken) {
        window.localStorage.setItem(GUEST_EDIT_TOKEN_KEY, data.editToken);
        setGuestEditToken(data.editToken);
      }
      setSubmitted(true);
      onSaved?.();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save your review.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <ModalShell onClose={onClose} title="Thank you for sharing">
        <div className="px-6 py-10 text-center sm:px-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#dff8ee] text-[#16865f]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </div>
          <h3 className="mt-5 text-xl font-semibold text-[#10263d]">Your review is live</h3>
          <p className="mt-2 text-sm leading-6 text-[#647a8d]">Thank you for helping people understand the Rolebolt experience.</p>
          <button type="button" onClick={onClose} className="mt-7 rounded-xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#07559f]">Done</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title={existing ? "Edit your review" : "Share your Rolebolt experience"}>
      <form onSubmit={submit} className="space-y-5 px-6 pb-7 sm:px-8">
        <p className="text-sm leading-6 text-[#647a8d]">
          Your review will be visible on the Rolebolt reviews page. You can edit it later.
        </p>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Your rating</label>
          <div className="mt-2 flex gap-1" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className={`text-3xl leading-none transition ${star <= rating ? "text-[#f6b940]" : "text-[#d4dee7]"}`}>★</button>
            ))}
          </div>
        </div>
        {!isRegistered && (
          <div>
            <label className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">I am reviewing as</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["seeker", "creator"] as const).map((item) => (
                <button key={item} type="button" onClick={() => setRole(item)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${role === item ? "border-[#0a66c2] bg-[#eaf3ff] text-[#0a66c2]" : "border-[#d9e5ee] text-[#647a8d] hover:border-[#9dbbd6]"}`}>
                  Job {item === "seeker" ? "Seeker" : "Creator"}
                </button>
              ))}
            </div>
            {!allowGuestReviews && <p className="mt-2 text-xs text-[#8a9aaa]">Guest reviews are currently disabled by the Rolebolt team.</p>}
          </div>
        )}
        <div>
          <label htmlFor="review-display-name" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Display name</label>
          <input id="review-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} placeholder="Your name" className="mt-2 w-full rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm text-[#203d56] outline-none focus:border-[#0a66c2]" />
        </div>
        <div>
          <label htmlFor="review-title" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Review title <span className="font-normal normal-case tracking-normal">(optional)</span></label>
          <input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="What stood out?" className="mt-2 w-full rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm text-[#203d56] outline-none focus:border-[#0a66c2]" />
        </div>
        <div>
          <label htmlFor="review-message" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Your review</label>
          <textarea id="review-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={5} placeholder="Tell people what your experience was like…" className="mt-2 w-full resize-none rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm leading-6 text-[#203d56] outline-none focus:border-[#0a66c2]" />
          <p className="mt-1 text-right text-[11px] text-[#9aaab8]">{message.length}/2000</p>
        </div>
        {error && <p className="rounded-xl border border-[#f0c8c8] bg-[#fff4f4] px-3.5 py-3 text-sm text-[#b54343]">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#0a66c2] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#07559f] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Saving…" : existing ? "Update review" : "Publish review"}
        </button>
      </form>
    </ModalShell>
  );
}

function ModalShell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#061522]/75 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white text-[#10263d] shadow-[0_30px_100px_rgba(0,0,0,.35)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[#e5edf3] px-6 py-5 sm:px-8">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.2em] text-[#0a66c2]">Rolebolt reviews</p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-[-.04em]">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close review form" className="rounded-xl p-2 text-[#8da1b1] hover:bg-[#f2f6f9] hover:text-[#203d56]">✕</button>
        </div>
        <div className="overflow-y-auto pt-5">{children}</div>
      </div>
    </div>
  );
}