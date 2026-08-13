"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPublicUrl, apiUrl, readApiJson } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RoleboltLogo } from "@/components/RoleboltLogo";

type InviteData = {
  inviteeName: string;
  inviteeEmailMasked: string;
  jobTitle: string;
  companyName: string;
  role: string;
  roleLabel: string;
  permissionBullets: string[];
  inviterName: string;
  expiresAt?: string;
  expired: boolean;
  jobId: string;
};

function formatExpiry(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function TeamInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const { authUser, recruitProfile, sessionToken, loading: authLoading } = useRecruitAuth();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  const invitePath = `/recruit/team-invite/${token}`;
  const loginHref = `/recruit/login?next=${encodeURIComponent(invitePath)}`;
  const signupHref = `/recruit/signup?next=${encodeURIComponent(invitePath)}`;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiPublicUrl(`/team-invite/${token}`));
        const data = await readApiJson(res);
        if (!res.ok) throw new Error(data.error || "Invitation not found.");
        setInvite(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load invitation.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  async function acceptInvitation() {
    if (!sessionToken) return;
    setAccepting(true);
    setAcceptError("");
    try {
      const res = await fetch(apiUrl(`/recruit/collaboration/team-invite/${token}/accept`), {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not accept invitation.");
      setAccepted(true);
      setTimeout(() => {
        router.push(`/recruit/jobs/${data.jobId ?? invite?.jobId}`);
      }, 1800);
    } catch (e: unknown) {
      setAcceptError(e instanceof Error ? e.message : "Could not accept invitation.");
    } finally {
      setAccepting(false);
    }
  }

  const expiryLabel = formatExpiry(invite?.expiresAt);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-[#0a66c2]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-500">Loading invitation…</p>
        </div>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Invitation unavailable</h1>
          <p className="text-sm text-slate-500 leading-6">{error || "This invitation link is invalid or has already been used."}</p>
          <Link href="/recruit/login" className="mt-6 inline-flex rounded-xl bg-[#0a66c2] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition">
            Go to sign in
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center rounded-3xl border border-emerald-200 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">You&apos;re on the team!</h1>
          <p className="text-sm text-slate-500">Redirecting you to {invite.jobTitle}…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <RoleboltLogo size="sm" />
          {!authUser && (
            <Link href={loginHref} className="text-sm font-semibold text-[#0a66c2] hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]">
          <div className="bg-gradient-to-br from-[#0a66c2] to-[#1d4ed8] px-6 py-8 sm:px-10 sm:py-10 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100/90 mb-3">Team invitation</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Join {invite.companyName || invite.jobTitle}
            </h1>
            <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed max-w-xl">
              <strong className="text-white">{invite.inviterName}</strong> invited you to collaborate on{" "}
              <strong className="text-white">{invite.jobTitle}</strong>
              {invite.companyName ? ` at ${invite.companyName}` : ""}.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-9 space-y-6">
            {invite.expired ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                This invitation expired{expiryLabel ? ` on ${expiryLabel}` : ""}. Ask {invite.inviterName} to send a new invite.
              </div>
            ) : expiryLabel ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Accept before <strong className="text-slate-900">{expiryLabel}</strong>.
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Invited as</p>
                <p className="text-base font-semibold text-slate-900">{invite.roleLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sent to</p>
                <p className="text-base font-semibold text-slate-900">{invite.inviteeEmailMasked}</p>
              </div>
            </div>

            {invite.permissionBullets.length > 0 && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">What you&apos;ll be able to do</p>
                <ul className="space-y-2">
                  {invite.permissionBullets.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!authUser ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                <p className="text-sm text-slate-600 leading-6">
                  Sign in or create a Rolebolt account with <strong>{invite.inviteeEmailMasked}</strong> to accept this invitation.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    href={loginHref}
                    className="flex-1 inline-flex items-center justify-center rounded-xl bg-[#0a66c2] px-5 py-3 text-sm font-bold text-white hover:bg-[#004182] transition"
                  >
                    Sign in to accept
                  </Link>
                  <Link
                    href={signupHref}
                    className="flex-1 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : !recruitProfile ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-600">Setting up your recruiter profile…</p>
              </div>
            ) : invite.expired ? null : (
              <div className="space-y-3">
                {acceptError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {acceptError}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Signed in as <strong className="text-slate-700">{authUser.email}</strong>
                </p>
                <button
                  type="button"
                  onClick={acceptInvitation}
                  disabled={accepting}
                  className="w-full rounded-xl bg-[#0a66c2] px-5 py-3.5 text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition shadow-lg shadow-blue-500/20"
                >
                  {accepting ? "Accepting…" : "Accept invitation"}
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 px-6 py-4 sm:px-10 bg-slate-50/50">
            <p className="text-[11px] text-slate-400 leading-5 text-center">
              If you weren&apos;t expecting this invitation, you can ignore this page. © Rolebolt
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
