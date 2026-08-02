"use client";

import { useState, useEffect, use } from "react";
import { apiPublicUrl } from "@/lib/api";

function getFrontendOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.rolebolt.tech";
}

// ─── Types ────────────────────────────────────────────────────────────────────

type OfferData = {
  offerLetter: string;
  offerStatus: "none" | "draft" | "approved" | "sent" | "expired";
  offerCandidateStatus: "pending" | "viewed" | "accepted" | "declined" | "expired" | null;
  offerDetails: {
    startDate?: string;
    salary?: string;
    salaryCurrency?: string;
    signingBonus?: string;
    benefits?: string;
    companyName?: string;
    hiringManagerName?: string;
    offerExpiryDate?: string;
    reportingManager?: string;
  };
  offerSignature?: { signedAt?: string; signerName?: string; method?: string };
  candidateName: string;
  jobTitle: string;
  companyName: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function expiryInfo(expiryDate?: string): { label: string; expired: boolean; urgent: boolean } | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now    = new Date();
  const diff   = expiry.getTime() - now.getTime();
  if (diff < 0)                      return { label: "Expired", expired: true, urgent: true };
  const days = Math.ceil(diff / 864e5);
  if (days === 0)                     return { label: "Expires today", expired: false, urgent: true };
  if (days === 1)                     return { label: "1 day left", expired: false, urgent: true };
  if (days <= 3)                      return { label: `${days} days left`, expired: false, urgent: true };
  return { label: `${days} days left`, expired: false, urgent: false };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OfferPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [offer, setOffer]             = useState<OfferData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [signerName, setSignerName]   = useState("");
  const [responding, setResponding]   = useState(false);
  const [responseError, setResponseError] = useState("");
  const [responded, setResponded]     = useState<"accepted" | "declined" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(apiPublicUrl(`/offer/${token}`));
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Offer not found."); return; }
        setOffer(data);
      } catch {
        setError("Failed to load offer. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function respond(response: "accepted" | "declined") {
    if (response === "accepted" && !signerName.trim()) {
      setResponseError("Please type your full name to sign the offer.");
      return;
    }
    setResponding(true);
    setResponseError("");
    try {
      const res  = await fetch(apiPublicUrl(`/offer/${token}/respond`), {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ response, signerName: signerName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit response.");
      setResponded(response);
      setOffer(prev => prev ? { ...prev, offerCandidateStatus: response } : prev);
    } catch (e: any) {
      setResponseError(e.message);
    } finally {
      setResponding(false);
      setConfirmDecline(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm text-gray-500">Loading your offer…</p>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !offer) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Offer Not Found</h2>
          <p className="text-sm text-gray-500">{error || "This offer link is invalid or has been removed."}</p>
        </div>
      </div>
    );
  }

  const expiry    = expiryInfo(offer.offerDetails?.offerExpiryDate);
  const isExpired = offer.offerStatus === "expired" || offer.offerCandidateStatus === "expired" || expiry?.expired;
  const hasResponded = responded || offer.offerCandidateStatus === "accepted" || offer.offerCandidateStatus === "declined";
  const wasAccepted  = responded === "accepted" || offer.offerCandidateStatus === "accepted";
  const wasDeclined  = responded === "declined" || offer.offerCandidateStatus === "declined";

  // ── Accepted state ─────────────────────────────────────────────────────────
  if (wasAccepted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-emerald-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Offer Accepted! 🎉</h2>
          <p className="text-sm text-gray-600 mb-4">
            You've officially accepted the offer for <strong>{offer.jobTitle}</strong>
            {offer.companyName ? ` at ${offer.companyName}` : ""}. The recruiter has been notified.
          </p>
          {offer.offerDetails?.startDate && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 text-sm text-emerald-700 font-medium">
              🗓 Start date: {new Date(offer.offerDetails.startDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </div>
          )}
          <p className="mt-4 text-xs text-gray-400">We look forward to having you on board.</p>
        </div>
      </div>
    );
  }

  // ── Declined state ─────────────────────────────────────────────────────────
  if (wasDeclined) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Offer Declined</h2>
          <p className="text-sm text-gray-500">
            You've declined the offer for <strong>{offer.jobTitle}</strong>. The recruiter has been notified.
          </p>
        </div>
      </div>
    );
  }

  // ── Expired state ──────────────────────────────────────────────────────────
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-amber-200 shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Offer Expired</h2>
          <p className="text-sm text-gray-500">
            This offer for <strong>{offer.jobTitle}</strong> has passed its expiry date. Please contact the recruiter if you believe this is a mistake.
          </p>
        </div>
      </div>
    );
  }

  // ── Active offer ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f8fa] py-8 px-4">
      <div className="max-w-2xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-6">
          <span className="inline-block bg-white border border-gray-200 rounded-xl px-3 py-1 text-xs font-semibold text-gray-500 mb-3 shadow-sm">
            Rolebolt · Secure Offer Portal
          </span>
          <h1 className="text-2xl font-bold text-gray-900">
            {offer.companyName ? `${offer.companyName} — ` : ""}{offer.jobTitle}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Hi {offer.candidateName}, please review your offer below.
          </p>
        </div>

        {/* ── Expiry banner ── */}
        {expiry && !expiry.expired && (
          <div className={`rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-sm font-medium ${
            expiry.urgent
              ? "bg-amber-50 border border-amber-200 text-amber-700"
              : "bg-blue-50 border border-blue-200 text-blue-700"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {expiry.urgent ? `⚠️ ` : "⏰ "}Offer valid for: <strong>{expiry.label}</strong>
            {offer.offerDetails?.offerExpiryDate && (
              <span className="ml-auto text-xs font-normal opacity-70">
                Expires {new Date(offer.offerDetails.offerExpiryDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
        )}

        {/* ── Offer Key Details ── */}
        {(offer.offerDetails?.salary || offer.offerDetails?.startDate) && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Offer Summary</h3>
            <div className="grid grid-cols-2 gap-3">
              {offer.offerDetails.startDate && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Start Date</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {new Date(offer.offerDetails.startDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              )}
              {offer.offerDetails.salary && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Compensation</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {offer.offerDetails.salaryCurrency || "INR"} {offer.offerDetails.salary}
                  </p>
                </div>
              )}
              {offer.offerDetails.signingBonus && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Signing Bonus</p>
                  <p className="text-sm font-semibold text-gray-800">{offer.offerDetails.signingBonus}</p>
                </div>
              )}
              {offer.offerDetails.reportingManager && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Reporting To</p>
                  <p className="text-sm font-semibold text-gray-800">{offer.offerDetails.reportingManager}</p>
                </div>
              )}
              {offer.offerDetails.benefits && (
                <div className="bg-gray-50 rounded-xl p-3 col-span-2">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Benefits</p>
                  <p className="text-sm text-gray-700">{offer.offerDetails.benefits}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Offer Letter ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Offer Letter</h3>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-serif border-l-2 border-indigo-200 pl-4">
            {offer.offerLetter}
          </div>
        </div>

        {/* ── E-Signature & Response ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Your Response</h3>
          <p className="text-xs text-gray-500 mb-4">
            To accept, type your full name below as your electronic signature. To decline, use the Decline button.
          </p>

          {/* Signature input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Electronic Signature</label>
            <input
              type="text"
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder={`Type your full name: ${offer.candidateName}`}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20 transition font-serif"
            />
            <p className="text-[10px] text-gray-400 mt-1">By typing your name, you agree this constitutes a legally binding electronic signature.</p>
          </div>

          {responseError && (
            <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-600">
              {responseError}
            </div>
          )}

          {/* Confirm decline dialog */}
          {confirmDecline && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <p className="text-sm font-medium text-amber-800 mb-3">Are you sure you want to decline this offer?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => respond("declined")}
                  disabled={responding}
                  className="flex-1 rounded-xl bg-rose-500 text-white text-sm font-semibold py-2 hover:bg-rose-600 transition disabled:opacity-50"
                >
                  {responding ? "Submitting…" : "Yes, decline"}
                </button>
                <button
                  onClick={() => setConfirmDecline(false)}
                  className="flex-1 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium py-2 hover:bg-gray-50 transition"
                >
                  Go back
                </button>
              </div>
            </div>
          )}

          {!confirmDecline && (
            <div className="flex gap-3">
              <button
                onClick={() => respond("accepted")}
                disabled={responding || !signerName.trim()}
                className="flex-1 rounded-xl bg-indigo-600 text-white text-sm font-bold py-3 hover:bg-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {responding ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Submitting…
                  </span>
                ) : "✓ Accept Offer"}
              </button>
              <button
                onClick={() => setConfirmDecline(true)}
                disabled={responding}
                className="rounded-xl border border-gray-200 text-gray-600 text-sm font-medium px-5 py-3 hover:bg-gray-50 hover:text-rose-600 hover:border-rose-200 transition disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-3">
            Powered by Rolebolt · This offer is securely delivered and your response is legally recorded.
          </p>
        </div>

      </div>
    </div>
  );
}
