"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { useCategoryEntitlement } from "@/contexts/BillingEntitlementContext";
import {
  getVideoReviewEligibility,
  isValidPublicVideoUrl,
  VIDEO_REVIEW_RULES_PATH,
} from "@/lib/videoReview";

type ReviewMode = "text" | "video";

type Review = {
  id: string;
  rating: number;
  title: string;
  message: string;
  displayName: string;
  role: "creator" | "seeker";
  videoUrl?: string;
};

const GUEST_EDIT_TOKEN_KEY = "rolebolt_guest_review_edit_token";

export function ReviewModal({ onClose, onSaved }: { onClose: () => void; onSaved?: () => void }) {
  const { sessionToken, authUser, recruitProfile } = useRecruitAuth();
  const seekerEntitlement = useCategoryEntitlement("seeker");
  const [mode, setMode] = useState<ReviewMode>("text");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [displayName, setDisplayName] = useState(authUser?.name || authUser?.username || "");
  const [role, setRole] = useState<"creator" | "seeker">(recruitProfile?.role || "seeker");
  const [existing, setExisting] = useState<Review | null>(null);
  const [allowGuestReviews, setAllowGuestReviews] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submittedMode, setSubmittedMode] = useState<ReviewMode>("text");
  const [guestEditToken, setGuestEditToken] = useState("");

  const isRegistered = Boolean(sessionToken && recruitProfile);
  const eligibility = getVideoReviewEligibility({
    isRegistered,
    role: recruitProfile?.role,
    plan: seekerEntitlement.plan,
  });

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
          if (me.review.videoUrl) {
            setMode("video");
            setVideoUrl(me.review.videoUrl);
          }
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

    if (mode === "video") {
      if (!isRegistered) return setError("Please sign in before submitting a video review.");
      if (!displayName.trim()) return setError("Please enter the name you want to show.");
      if (!isValidPublicVideoUrl(videoUrl)) return setError("Please enter a valid public video URL.");
    } else {
      if (!displayName.trim()) return setError("Please enter the name you want to show.");
      if (message.trim().length < 10) return setError("Please write at least 10 characters.");
    }

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
          title: mode === "text" ? title.trim() || undefined : undefined,
          message: mode === "text" ? message.trim() : undefined,
          displayName: displayName.trim(),
          role: isRegistered ? undefined : role,
          editToken: !isRegistered ? guestEditToken || undefined : undefined,
          ...(mode === "video" ? {
            videoUrl: videoUrl.trim(),
            submitterPlan: recruitProfile?.role === "seeker" ? seekerEntitlement.plan : undefined,
          } : {}),
        }),
      });
      const data = await readApiJson<{ error?: string; editToken?: string }>(response);
      if (!response.ok) throw new Error(data.error || "We couldn't save your review.");
      if (!isRegistered && data.editToken) {
        window.localStorage.setItem(GUEST_EDIT_TOKEN_KEY, data.editToken);
        setGuestEditToken(data.editToken);
      }
      setSubmittedMode(mode);
      setSubmitted(true);
      onSaved?.();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't save your review.");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    const isVideo = submittedMode === "video";
    return (
      <ModalShell onClose={onClose} title={isVideo ? "Video review submitted" : "Thank you for sharing"}>
        <div className="px-6 py-10 text-center sm:px-8">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isVideo ? "bg-[#eaf3ff] text-[#0a66c2]" : "bg-[#dff8ee] text-[#16865f]"}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
          </div>
          <h3 className="mt-5 text-xl font-semibold text-[#10263d]">
            {isVideo ? "Sent for Admin review" : "Your review is live"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#647a8d]">
            {isVideo
              ? "Your video review has been submitted for Admin review. Any reward is subject to Admin approval."
              : "Thank you for helping people understand the Rolebolt experience."}
          </p>
          <button type="button" onClick={onClose} className="mt-7 rounded-xl bg-[#0a66c2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#07559f]">Done</button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title={existing ? "Edit your review" : "Share your Rolebolt experience"}>
      <form onSubmit={submit} className="space-y-5 px-6 pb-7 sm:px-8">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Review type</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              ["text", "Write a Review"],
              ["video", "Video Review"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${mode === value ? "border-[#0a66c2] bg-[#eaf3ff] text-[#0a66c2]" : "border-[#d9e5ee] text-[#647a8d] hover:border-[#9dbbd6]"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mode === "text" ? (
          <p className="text-sm leading-6 text-[#647a8d]">
            Your review will be visible on the Rolebolt reviews page. You can edit it later.
          </p>
        ) : (
          <p className="text-sm leading-6 text-[#647a8d]">
            Share a public video link for Admin review. Rewards are not automatic.
          </p>
        )}

        <div>
          <label className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Your rating</label>
          <div className="mt-2 flex gap-1" aria-label={`${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} type="button" onClick={() => setRating(star)} aria-label={`${star} stars`} className={`text-3xl leading-none transition ${star <= rating ? "text-[#f6b940]" : "text-[#d4dee7]"}`}>★</button>
            ))}
          </div>
        </div>

        {mode === "text" && !isRegistered && (
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

        {mode === "video" && !isRegistered ? (
          <div className="rounded-2xl border border-[#d9e5ee] bg-[#f8fbfd] px-4 py-5">
            <p className="text-sm font-semibold text-[#203d56]">Sign in required</p>
            <p className="mt-2 text-sm leading-6 text-[#647a8d]">
              Please sign in to your Rolebolt account before submitting a video review.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link href="/seeker/login" className="inline-flex items-center justify-center rounded-xl bg-[#0a66c2] px-4 py-3 text-sm font-semibold text-white hover:bg-[#07559f]">
                Sign in as Job Seeker
              </Link>
              <Link href="/recruit/login" className="inline-flex items-center justify-center rounded-xl border border-[#d9e5ee] bg-white px-4 py-3 text-sm font-semibold text-[#31536e] hover:border-[#0a66c2]">
                Sign in as Job Creator
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="review-display-name" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Display name</label>
              <input id="review-display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={100} placeholder="Your name" className="mt-2 w-full rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm text-[#203d56] outline-none focus:border-[#0a66c2]" />
            </div>

            {mode === "text" ? (
              <>
                <div>
                  <label htmlFor="review-title" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Review title <span className="font-normal normal-case tracking-normal">(optional)</span></label>
                  <input id="review-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="What stood out?" className="mt-2 w-full rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm text-[#203d56] outline-none focus:border-[#0a66c2]" />
                </div>
                <div>
                  <label htmlFor="review-message" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Your review</label>
                  <textarea id="review-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={5} placeholder="Tell people what your experience was like…" className="mt-2 w-full resize-none rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm leading-6 text-[#203d56] outline-none focus:border-[#0a66c2]" />
                  <p className="mt-1 text-right text-[11px] text-[#9aaab8]">{message.length}/2000</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="review-video-url" className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Public video URL</label>
                  <input
                    id="review-video-url"
                    type="url"
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    placeholder="https://youtube.com/watch?v=… or https://x.com/…"
                    className="mt-2 w-full rounded-xl border border-[#d9e5ee] bg-white px-3.5 py-3 text-sm text-[#203d56] outline-none focus:border-[#0a66c2]"
                  />
                  <p className="mt-2 text-xs leading-5 text-[#8a9aaa]">Paste a public link from YouTube, X, or another platform.</p>
                </div>

                <div className="rounded-2xl border border-[#d9e5ee] bg-[#f8fbfd] px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[.12em] text-[#718496]">Reward guidelines</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["2× face visible", "1.5× no face", "0.5× AI video"].map((item) => (
                      <span key={item} className="rounded-full border border-[#cfe4f7] bg-white px-3 py-1 text-xs font-semibold text-[#31536e]">
                        {item}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#647a8d]">{eligibility.rewardMessage}</p>
                  <p className="mt-2 text-xs leading-5 text-[#8a9aaa]">
                    Please review the rules before submitting.{" "}
                    <Link href={VIDEO_REVIEW_RULES_PATH} target="_blank" className="font-semibold text-[#0a66c2] hover:underline">
                      View Rules &amp; Rewards
                    </Link>
                  </p>
                </div>
              </>
            )}
          </>
        )}

        {error && <p className="rounded-xl border border-[#f0c8c8] bg-[#fff4f4] px-3.5 py-3 text-sm text-[#b54343]">{error}</p>}

        {(mode === "text" || isRegistered) && (
          <button type="submit" disabled={busy || loading} className="w-full rounded-xl bg-[#0a66c2] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#07559f] disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Saving…" : mode === "video" ? "Submit video review" : existing ? "Update review" : "Publish review"}
          </button>
        )}
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
