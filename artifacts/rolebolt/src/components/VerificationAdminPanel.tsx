"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  fetchVerificationRequests,
  fetchAuthSettings,
  updateAuthSettings,
  rejectCompany,
  unverifyCompany,
  verifyCompany,
  type AdminVerificationRequest,
  type VerificationRequestStatus,
} from "@/lib/raka98Admin";

const TABS: { id: VerificationRequestStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "verified", label: "Verified" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function statusBadge(status: AdminVerificationRequest["verificationStatus"]) {
  if (status === "verified") {
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
  }
  if (status === "requested") {
    return "bg-amber-500/15 text-amber-400 border-amber-500/25";
  }
  if (status === "rejected") {
    return "bg-red-500/15 text-red-400 border-red-500/25";
  }
  return "bg-white/5 text-white/45 border-white/10";
}

function DetailRow({ label, value, href }: { label: string; value: string; href?: string }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-white/30">{label}</div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-400 hover:text-blue-300 break-all"
        >
          {value}
        </a>
      ) : (
        <div className="text-sm text-white/75 break-words">{value}</div>
      )}
    </div>
  );
}

function VerificationRequestCard({
  request,
  onActionComplete,
}: {
  request: AdminVerificationRequest;
  onActionComplete: () => void;
}) {
  const [note, setNote] = useState(request.verificationNote || "");
  const [busy, setBusy] = useState<"verify" | "reject" | "unverify" | null>(null);
  const [message, setMessage] = useState("");

  async function runAction(
    action: "verify" | "reject" | "unverify",
    runner: (uid: string, note: string) => Promise<unknown>,
  ) {
    setBusy(action);
    setMessage("");
    try {
      const result = await runner(request.uid, note.trim());
      const jobsUpdated = (result as { jobsUpdated?: number }).jobsUpdated ?? 0;
      setMessage(
        action === "verify"
          ? `Verified. ${jobsUpdated} job listing${jobsUpdated === 1 ? "" : "s"} updated.`
          : action === "reject"
            ? "Request rejected."
            : `Verification removed. ${jobsUpdated} job listing${jobsUpdated === 1 ? "" : "s"} updated.`,
      );
      onActionComplete();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white/90">
              {request.companyName || request.displayName || "Unnamed profile"}
            </h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusBadge(request.verificationStatus)}`}>
              {request.verificationStatus === "requested" ? "Pending review" : request.verificationStatus}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-1">{request.profileTypeLabel}</p>
        </div>
        <div className="text-right text-xs text-white/35">
          <div>Requested: {formatDate(request.verificationRequestedAt)}</div>
          {request.verifiedAt && <div>Verified: {formatDate(request.verifiedAt)}</div>}
        </div>
      </div>

      <div className="px-5 py-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Creator email" value={request.email} href={request.email ? `mailto:${request.email}` : undefined} />
            <DetailRow label="Username" value={request.username ? `@${request.username}` : ""} />
            <DetailRow label="Location" value={request.location} />
            <DetailRow label="Industry" value={request.industry} />
            <DetailRow label="Company type" value={request.companyType} />
            <DetailRow label="Company size" value={request.companySize} />
            <DetailRow label="Active jobs" value={String(request.activeJobCount)} />
            <DetailRow label="Total jobs" value={String(request.jobCount)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Website" value={request.website} href={request.website || undefined} />
            <DetailRow label="LinkedIn" value={request.linkedinUrl || request.personalLinkedinUrl} href={request.linkedinUrl || request.personalLinkedinUrl || undefined} />
            <DetailRow label="Portfolio" value={request.portfolioUrl} href={request.portfolioUrl || undefined} />
            <DetailRow label="Registration / affiliation" value={request.registrationNumber || request.affiliationNumber} />
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1">Description</div>
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap">{request.description || "—"}</p>
          </div>

          {request.mission && (
            <div>
              <div className="text-[10px] uppercase tracking-wide text-white/30 mb-1">Mission</div>
              <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{request.mission}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-wide text-white/30">Admin note (optional)</div>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Internal note or rejection reason"
              className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-white/25"
            />

            <div className="flex flex-col gap-2">
              {(request.verificationStatus === "requested" || request.verificationStatus === "rejected") && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runAction("verify", verifyCompany)}
                  className="w-full rounded-lg bg-emerald-500 text-black text-sm font-semibold py-2.5 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {busy === "verify" ? "Verifying…" : "Verify company"}
                </button>
              )}

              {request.verificationStatus === "requested" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runAction("reject", rejectCompany)}
                  className="w-full rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm font-medium py-2.5 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
                >
                  {busy === "reject" ? "Rejecting…" : "Reject request"}
                </button>
              )}

              {request.verificationStatus === "verified" && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => runAction("unverify", unverifyCompany)}
                  className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm font-medium py-2.5 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
                >
                  {busy === "unverify" ? "Removing…" : "Remove verification"}
                </button>
              )}
            </div>

            {message && <p className="text-xs text-white/55">{message}</p>}
          </div>

          <div className="rounded-lg border border-white/8 bg-black/20 p-4 space-y-2 text-xs">
            <div className="text-[10px] uppercase tracking-wide text-white/30">Quick links</div>
            {request.publicProfileUrl && (
              <Link href={request.publicProfileUrl} className="block text-blue-400 hover:text-blue-300">
                Public profile
              </Link>
            )}
            <div className="text-white/35 font-mono text-[11px] break-all">UID: {request.uid}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

export function VerificationAdminPanel() {
  const [tab, setTab] = useState<VerificationRequestStatus>("pending");
  const [requests, setRequests] = useState<AdminVerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authSettings, setAuthSettings] = useState({ requireEmailVerification: true });
  const [authSettingsLoading, setAuthSettingsLoading] = useState(true);
  const [authSettingsSaving, setAuthSettingsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchVerificationRequests(tab);
      setRequests(rows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load verification requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void fetchAuthSettings()
      .then((settings) => {
        if (!cancelled) setAuthSettings(settings);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load authentication settings.");
      })
      .finally(() => {
        if (!cancelled) setAuthSettingsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function toggleEmailVerification() {
    setAuthSettingsSaving(true);
    setError("");
    try {
      const settings = await updateAuthSettings({
        requireEmailVerification: !authSettings.requireEmailVerification,
      });
      setAuthSettings(settings);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update authentication settings.");
    } finally {
      setAuthSettingsSaving(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74d8ba]">Account access</p>
            <h3 className="mt-1 text-base font-semibold text-white/90">Require email verification for manual signups</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-white/45">
              {authSettings.requireEmailVerification
                ? "ON: email/password users must verify their email before signing in."
                : "OFF: new and existing unverified email/password users can access their account immediately. Social sign-in is unchanged."}
            </p>
          </div>
          <button
            type="button"
            disabled={authSettingsLoading || authSettingsSaving}
            onClick={() => void toggleEmailVerification()}
            aria-label="Toggle email verification requirement"
            className={`relative h-6 w-11 shrink-0 rounded-full transition ${authSettings.requireEmailVerification ? "bg-[#41d2a0]" : "bg-white/15"} disabled:opacity-50`}
          >
            <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${authSettings.requireEmailVerification ? "left-6" : "left-1"}`} />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-2">
            Company verification
          </p>
          <h2 className="text-2xl font-semibold text-white/90 tracking-tight">
            Verification requests
          </h2>
          <p className="mt-2 text-sm text-white/45 max-w-2xl">
            Review creator verification submissions. Approving a company updates the verified badge everywhere, including all existing job listings.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs text-white/40 hover:text-white/70 transition-colors disabled:opacity-40"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition-colors ${
              tab === item.id
                ? "bg-white text-black border-white"
                : "bg-transparent text-white/45 border-white/10 hover:border-white/20 hover:text-white/70"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="h-40 rounded-xl border border-white/8 bg-white/[0.02] animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
          <p className="text-sm text-white/50">No verification requests in this tab.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <VerificationRequestCard key={request.uid} request={request} onActionComplete={load} />
          ))}
        </div>
      )}
    </section>
  );
}
