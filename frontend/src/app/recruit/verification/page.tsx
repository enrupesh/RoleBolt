"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { apiUrl, readApiJson } from "@/lib/api";
import { RecruitGuard } from "@/components/RecruitGuard";
import { RoleboltLogo } from "@/components/RoleboltLogo";

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#0a66c2", "#22c55e", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#ec4899", "#10b981",
];

function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 72 }, (_, i) => {
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const left = `${Math.random() * 100}%`;
    const delay = `${Math.random() * 0.8}s`;
    const duration = `${1.2 + Math.random() * 1.2}s`;
    const size = 6 + Math.floor(Math.random() * 8);
    const isCircle = i % 3 === 0;
    return (
      <span
        key={i}
        style={{
          position: "fixed",
          top: "-16px",
          left,
          width: size,
          height: isCircle ? size : size * 0.5,
          backgroundColor: color,
          borderRadius: isCircle ? "50%" : "2px",
          animationName: "confettiFall",
          animationDuration: duration,
          animationDelay: delay,
          animationTimingFunction: "cubic-bezier(.23,1,.32,1)",
          animationFillMode: "forwards",
          opacity: 0,
          zIndex: 9999,
          transform: `rotate(${Math.random() * 360}deg)`,
          pointerEvents: "none",
        }}
      />
    );
  });
  return <>{pieces}</>;
}

// ─── Profile type labels ──────────────────────────────────────────────────────

const PROFILE_TYPE_LABELS: Record<string, string> = {
  company: "Company / Organisation",
  educational_institute: "Educational Institute",
  individual: "Individual / Freelance Recruiter",
  content_creator: "Content Creator / Personal Brand",
  ngo_government: "NGO / Government",
};

const VERIFICATION_DOCS: Record<string, { docs: string[]; note: string }> = {
  company: {
    docs: [
      "Company GST certificate or CIN registration number",
      "Official company email domain (e.g. yourname@yourcompany.com)",
      "LinkedIn company page URL",
      "Business website with active domain",
    ],
    note: "We verify that the company is a real, operating business and that the job poster is affiliated with it.",
  },
  educational_institute: {
    docs: [
      "UDISE / AICTE / UGC / NAAC accreditation number",
      "Official institute website",
      "Affiliation certificate or government recognition document",
    ],
    note: "We verify the institute's registration and affiliation with a recognised board or regulatory body.",
  },
  individual: {
    docs: [
      "LinkedIn profile URL (must be public and active)",
      "Portfolio or personal website",
      "A brief note about the type of work you hire for",
    ],
    note: "We verify your identity through LinkedIn and your professional online presence.",
  },
  content_creator: {
    docs: [
      "YouTube / Instagram / podcast channel URL (must be public)",
      "Minimum 500 followers or subscribers on any one platform",
      "Official email or link bio showing brand affiliation",
    ],
    note: "We verify that you are the actual owner of the brand/channel and not impersonating someone else.",
  },
  ngo_government: {
    docs: [
      "12A / FCRA / government registration certificate",
      "Official government or NGO website URL",
      "Organisation registration number",
    ],
    note: "We verify your registration with the relevant government authority or regulatory body.",
  },
};

// ─── Main component ───────────────────────────────────────────────────────────

function VerificationContent() {
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string>("");
  const [profileType, setProfileType] = useState<string>("company");
  const [companyName, setCompanyName] = useState<string>("");
  const [verificationStatus, setVerificationStatus] = useState<"none" | "requested" | "verified" | "rejected">("none");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [error, setError] = useState("");
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeLabel = PROFILE_TYPE_LABELS[profileType] || "Profile";
  const docs = VERIFICATION_DOCS[profileType] || VERIFICATION_DOCS.company;

  // Cleanup confetti timer on unmount
  useEffect(() => {
    return () => {
      if (confettiTimerRef.current) clearTimeout(confettiTimerRef.current);
    };
  }, []);

  const { sessionToken } = useRecruitAuth();
  useEffect(() => {
    if (!sessionToken) return;
    setAuthToken(sessionToken);
    (async () => {
      try {
        const res = await fetch(apiUrl("/recruit/company/profile"), {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (res.ok) {
          const data = await readApiJson(res);
          if (data.profile) {
            setProfileType(data.profile.profileType || "company");
            setCompanyName(data.profile.companyName || "");
            const status = data.profile.verificationStatus || "none";
            setVerificationStatus(status);
            if (status === "requested" || status === "verified") {
              setSubmitted(true);
            }
          }
        } else {
          setLoadError("Could not load your profile. Please go back and try again.");
        }
      } catch {
        setLoadError("Failed to load profile. Please check your connection and try again.");
      }
      setLoading(false);
    })();
  }, [sessionToken]);

  const handleRequest = useCallback(async () => {
    if (submitting) return;
    if (!authToken) {
      setError("Authentication error — please refresh the page and try again.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const freshToken = authToken;
      const res = await fetch(apiUrl("/recruit/company/request-verification"), {
        method: "POST",
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to submit request.");
      // Trigger confetti + success
      setConfetti(true);
      confettiTimerRef.current = setTimeout(() => setConfetti(false), 3200);
      setSubmitted(true);
      setVerificationStatus("requested");
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [authToken, submitting]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white animate-[rb-fade-in_0.3s_ease_both]">
        {/* Header skeleton */}
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-lg rb-skeleton" />
              <div className="h-4 w-20 rounded-full rb-skeleton" />
            </div>
            <div className="h-4 w-28 rounded-full rb-skeleton" />
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14 space-y-5">
          {/* Title block */}
          <div className="mb-8 space-y-2">
            <div className="h-5 w-32 rounded-full rb-skeleton" />
            <div className="h-7 w-3/5 rounded-lg rb-skeleton mt-3" />
            <div className="h-3.5 w-2/5 rounded-full rb-skeleton mt-1" />
          </div>
          {/* Info cards */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
              <div className="h-3.5 w-32 rounded-full rb-skeleton" />
              <div className="h-3 w-full rounded-full rb-skeleton" />
              <div className="h-3 w-4/5 rounded-full rb-skeleton" />
              <div className="h-3 w-3/5 rounded-full rb-skeleton" />
            </div>
          ))}
          {/* CTA button */}
          <div className="h-12 w-48 rounded-full rb-skeleton" />
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-600 mb-4">{loadError}</p>
          <Link href="/recruit/recruiter-profile" className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            ← Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">

      {/* Confetti CSS */}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>

      <Confetti active={confetti} />

      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-2xl px-4 py-4 sm:px-6 flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2.5">
            <RoleboltLogo size="sm" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <Link
            href="/recruit/recruiter-profile"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            ← Back to Profile
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">

        {submitted ? (
          verificationStatus === "verified" ? (
            <div className="text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 border-2 border-green-200">
                <svg width="36" height="36" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Your profile is verified</h1>
              <p className="mt-3 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                A verified badge now appears on your public profile and all job listings.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link href="/recruit/dashboard" className="inline-flex items-center justify-center rounded-full bg-[#0a66c2] px-7 py-3 text-sm font-bold text-white hover:bg-[#004182] transition">
                  Go to Dashboard
                </Link>
              </div>
            </div>
          ) : (
          // ── SUCCESS STATE ──────────────────────────────────────────────────
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 border-2 border-green-200">
              <svg width="36" height="36" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Verification Request Submitted!
            </h1>
            <p className="mt-3 text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
              Your request has been received. Our team will review your {typeLabel.toLowerCase()} profile and get back to you within <strong>7 business days</strong>.
            </p>

            {/* What happens next */}
            <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6 text-left">
              <h2 className="text-sm font-bold text-slate-900 mb-4">What happens next?</h2>
              <ol className="space-y-3">
                {[
                  { step: "1", title: "Team reviews your profile", desc: "We check your name, description, website, and other details against public records." },
                  { step: "2", title: "Verification type determined", desc: "Depending on your profile type, our team may reach out to you via the contact info on your profile." },
                  { step: "3", title: "Decision made", desc: "You'll receive an update within 7 business days. Approved profiles get a blue verified badge immediately." },
                ].map(item => (
                  <li key={item.step} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-[11px] font-black text-white mt-0.5">{item.step}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Benefits after verified */}
            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6 text-left">
              <h2 className="text-sm font-bold text-[#0a66c2] mb-3 flex items-center gap-2">
                <span>🏅</span> Once verified, you will get:
              </h2>
              <ul className="space-y-2">
                {[
                  "✓ Blue verified tick next to your name and company",
                  "✓ \"Verified\" badge on every job listing you post",
                  "✓ Higher ranking in job search results",
                  "✓ Priority display to job seekers browsing the board",
                  "✓ Access to advanced hiring features (coming soon)",
                  "✓ Increased trust — more candidates apply to verified listings",
                ].map(b => (
                  <li key={b} className="text-xs text-slate-700 font-medium">{b}</li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/recruit/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-[#0a66c2] px-7 py-3 text-sm font-bold text-white hover:bg-[#004182] transition"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/recruit/recruiter-profile"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-7 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Back to Profile
              </Link>
            </div>
          </div>
          )
        ) : (
          // ── VERIFICATION INFO PAGE ─────────────────────────────────────────
          <>
            {verificationStatus === "rejected" && (
              <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-xs font-bold text-red-800 uppercase tracking-wide mb-1">Previous request not approved</p>
                <p className="text-sm text-red-900 leading-relaxed">
                  Your last verification request was not approved. Update your profile details if needed, then submit a new request below.
                </p>
              </div>
            )}

            {/* Title */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-600 mb-4">
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Profile Verification
              </div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl leading-tight">
                Get your {typeLabel} verified
              </h1>
              {companyName && (
                <p className="mt-2 text-sm text-slate-500">
                  Requesting verification for: <span className="font-semibold text-slate-800">{companyName}</span>
                </p>
              )}
            </div>

            {/* Why verification exists */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5 mb-5">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Why we verify</p>
              <p className="text-sm text-amber-900 leading-relaxed">
                Verification prevents fake job listings, brand impersonation, and scam postings. It protects genuine employers and ensures job seekers can trust every listing on Rolebolt.
              </p>
            </div>

            {/* Mail to */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Contact for queries</p>
              <a
                href="mailto:verify@rolebolt.tech"
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-[#0a66c2]/30 hover:bg-blue-50/30 transition group"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0a66c2]/10">
                  <svg width="16" height="16" fill="none" stroke="#0a66c2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 group-hover:text-[#0a66c2] transition">verify@rolebolt.tech</p>
                  <p className="text-xs text-slate-500">For verification queries, disputes, or appeals</p>
                </div>
              </a>
            </div>

            {/* Verification process */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">How verification works</h2>
              <ol className="space-y-4">
                {[
                  { n: "1", t: "Submit your request", d: "Click the Request Verification button below. Your current profile details are automatically sent to our team." },
                  { n: "2", t: "Team review", d: "Our team reviews your profile type, name, description, website, and public records. The process is human-reviewed — not automated." },
                  { n: "3", t: "Verification type matched", d: `The verification method depends on your profile type (${typeLabel}). See the required documents below.` },
                  { n: "4", t: "Decision within 7 business days", d: "You will receive an update at your registered email. If approved, your verified badge goes live instantly." },
                ].map(item => (
                  <li key={item.n} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-black text-slate-600 mt-0.5">{item.n}</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.t}</p>
                      <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{item.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Required documents for their profile type */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
              <h2 className="text-sm font-bold text-slate-900 mb-1">
                What we check for: <span className="text-[#0a66c2]">{typeLabel}</span>
              </h2>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">{docs.note}</p>
              <ul className="space-y-2">
                {docs.docs.map((d, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0a66c2]">
                      <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>

            {/* Rules & guidelines */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Rules & guidelines</h2>
              <ul className="space-y-3 text-xs text-slate-600 leading-relaxed">
                {[
                  "Verification is free. Rolebolt does not charge any fee for reviewing or granting verified status.",
                  "Your profile must be fully filled — including your name, description, and website — before requesting verification.",
                  "Do not submit a verification request if you are representing a brand or company you are not authorised to act on behalf of.",
                  "Providing false information during verification will result in permanent removal from the platform.",
                  "Verified status can be revoked at any time if the profile is found to be misleading, inactive, or in violation of our policies.",
                  "One verification request is allowed per 30 days. Multiple requests within this period will be ignored.",
                  "Verification decisions are final. You may appeal by emailing verify@rolebolt.tech with supporting documents.",
                  "Verification does not guarantee a fixed response time, but we aim to complete all reviews within 7 business days.",
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-slate-400 font-bold">{i + 1}.</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            {/* What you get after verification */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 sm:p-6 mb-6">
              <h2 className="text-sm font-bold text-[#0a66c2] mb-3 flex items-center gap-2">
                <span>🏅</span> Benefits of getting verified
              </h2>
              <ul className="space-y-2">
                {[
                  { icon: "✓", text: "Blue verified tick displayed next to your company name on all pages" },
                  { icon: "✓", text: "\"Verified\" badge shown on every job listing you post" },
                  { icon: "✓", text: "Higher ranking in job search — verified listings appear first" },
                  { icon: "✓", text: "Priority display to job seekers on the opportunities board" },
                  { icon: "✓", text: "Increased candidate trust — verified employers receive up to 3× more applications" },
                  { icon: "✓", text: "Access to ultra features including advanced candidate insights (rolling out soon)" },
                ].map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-800 font-medium">
                    <span className="text-green-600 font-bold shrink-0">{b.icon}</span>
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* CTA button */}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleRequest}
                disabled={submitting}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-8 py-3.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition active:scale-95"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting request…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Request Verification
                  </>
                )}
              </button>
              <Link
                href="/recruit/recruiter-profile"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-7 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </Link>
            </div>

            <p className="mt-4 text-xs text-slate-400 leading-relaxed">
              By clicking "Request Verification" you confirm that all information on your profile is accurate and that you are authorised to represent the entity being verified. False submissions will result in account removal.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

export default function VerificationPage() {
  return <RecruitGuard requiredRole="creator"><VerificationContent /></RecruitGuard>;
}
