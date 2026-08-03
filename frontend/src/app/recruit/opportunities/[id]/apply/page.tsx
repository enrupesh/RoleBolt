import Link from "next/link";
import RecruitHeader from "@/components/RecruitHeader";
import ApplyForm from "../ApplyForm";
import { apiUrl, readApiJson } from "@/lib/api";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";

type Job = {
  _id: string;
  title: string;
  companyName?: string;
  location?: string;
  workMode?: string;
  jobType?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  verifiedCompany?: boolean;
  applicationDeadline?: string;
};

async function loadJob(id: string): Promise<Job | null> {
  try {
    const res = await fetch(apiUrl(`/recruit-public/jobs/${id}`), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await readApiJson(res);
    return (data.job ?? null) as Job | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const job = await loadJob(id);
  return buildMetadata({
    title: job
      ? `Apply — ${job.title}${job.companyName ? ` at ${job.companyName}` : ""} | Rolebolt`
      : "Apply | Rolebolt",
    description: "Submit your application on Rolebolt.",
    path: `/recruit/opportunities/${id}/apply`,
    noIndex: true,
  });
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await loadJob(id);

  function salaryLabel(j: Job) {
    if (!j.salaryMin && !j.salaryMax) return null;
    const cur = j.salaryCurrency || "INR";
    const locale = cur === "INR" ? "en-IN" : "en-US";
    const min = j.salaryMin?.toLocaleString(locale) ?? "0";
    const max = j.salaryMax ? `–${j.salaryMax.toLocaleString(locale)}` : "+";
    return `${cur} ${min}${max}`;
  }

  function deadlineLabel(j: Job) {
    if (!j.applicationDeadline) return null;
    const d = new Date(j.applicationDeadline);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <RecruitHeader />

      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 pb-16">

        {/* Back link */}
        <Link
          href={`/recruit/opportunities/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0a66c2] transition mb-5"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5" /><path d="m12 5-7 7 7 7" />
          </svg>
          Back to job details
        </Link>

        {/* Job context card */}
        {job && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-base font-black text-[#0a66c2]">
                {(job.companyName || job.title).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">{job.title}</p>
                <p className="text-xs text-slate-500 truncate">
                  {job.companyName && <span className="font-medium text-slate-700">{job.companyName} · </span>}
                  {job.location || "Remote"}
                  {job.workMode ? ` · ${job.workMode}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {job.verifiedCompany && (
                  <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    ✓ Verified
                  </span>
                )}
                {salaryLabel(job) && (
                  <span className="text-[11px] font-semibold text-emerald-700">{salaryLabel(job)}</span>
                )}
              </div>
            </div>

            {deadlineLabel(job) && (
              <p className="mt-3 text-center text-[11px] font-semibold text-rose-600">
                ⏰ Apply by {deadlineLabel(job)}
              </p>
            )}
          </div>
        )}

        {!job && (
          <div className="mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm text-center">
            <p className="text-sm text-slate-500">Loading job details…</p>
          </div>
        )}

        {/* The actual form */}
        <ApplyForm
          jobId={id}
          jobTitle={job?.title}
          companyName={job?.companyName}
        />

      </main>
    </div>
  );
}
