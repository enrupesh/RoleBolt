"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";

export default function SeekerJobActions({
  jobId,
  jobTitle,
}: {
  jobId: string;
  jobTitle: string;
}) {
  const { sessionToken, authUser, recruitProfile } = useRecruitAuth();
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState<"save" | "apply" | null>(null);
  const [error, setError] = useState<unknown>("");
  const [success, setSuccess] = useState("");

  const isSeeker =
    recruitProfile?.role === "seeker" ||
    (recruitProfile?.canAccessSeeker === true &&
      isJudgeReviewerEmail(authUser?.email));
  const token = sessionToken;

  useEffect(() => {
    if (!token || !isSeeker) return;
    fetch(apiUrl("/recruit/seeker/saved-jobs"), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { jobs: [] })
      .then(d => setSaved((d.jobs ?? []).some((j: { id: string }) => j.id === jobId)))
      .catch(() => {});
  }, [token, isSeeker, jobId]);

  if (!isSeeker || !token) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/seeker/login?redirect=/recruit/opportunities/${jobId}`}
          className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
        >
          Sign in to apply faster
        </Link>
        <Link
          href={`/recruit/opportunities/${jobId}/apply`}
          className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          Apply with form
        </Link>
      </div>
    );
  }

  async function toggleSave() {
    setLoading("save");
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/seeker/jobs/${jobId}/save`), {
        method: saved ? "DELETE" : "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw apiErrorFromPayload(res.status, d, "Could not update saved jobs.");
      }
      setSaved(!saved);
      setSuccess(saved ? "Removed from saved jobs" : "Job saved!");
      setTimeout(() => setSuccess(""), 2500);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(null);
    }
  }

  async function oneClickApply() {
    setLoading("apply");
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/seeker/jobs/${jobId}/apply`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && (d.code === "DUPLICATE_APPLICATION" || d.error === "DUPLICATE_APPLICATION")) {
        setApplied(true);
        setSuccess("You already applied to this job.");
        return;
      }
      if (!res.ok) throw apiErrorFromPayload(res.status, d, "Application failed.");
      setApplied(true);
      setSuccess("Application submitted with your saved profile!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: unknown) {
      setError(e);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={oneClickApply}
          disabled={loading !== null || applied}
          className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {loading === "apply" ? "Applying…" : applied ? "Applied ✓" : "One-Click Apply"}
        </button>
        <button
          type="button"
          onClick={toggleSave}
          disabled={loading !== null}
          className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-60"
        >
          {loading === "save" ? "…" : saved ? "Saved ★" : "Save Job"}
        </button>
        <Link
          href={`/recruit/opportunities/${jobId}/apply`}
          className="rounded-full border-2 border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
        >
          Full apply form
        </Link>
      </div>
      <SeekerErrorNotice error={error} className="text-xs" />
      {success && <p className="text-xs font-medium text-emerald-600">{success}</p>}
      {!applied && (
        <p className="text-[11px] text-slate-500">
          One-click apply uses your saved profile & resume for {jobTitle}.
        </p>
      )}
    </div>
  );
}
