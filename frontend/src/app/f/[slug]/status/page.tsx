"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";

type StatusResult = {
  found: boolean;
  formTitle?: string;
  companyName?: string;
  applicantName?: string;
  stage?: string;
  stageLabel?: string;
  updatedAt?: string;
};

const STAGE_STYLE: Record<string, string> = {
  shortlisted: "bg-blue-50 text-blue-700 border-blue-200",
  interview: "bg-amber-50 text-amber-700 border-amber-200",
  offer: "bg-cyan-50 text-cyan-700 border-cyan-200",
  hired: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-600 border-rose-200",
};

export default function FormApplicationStatusPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<StatusResult | null>(null);

  async function checkStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(apiUrl(`/recruit-public/forms/${slug}/status?email=${encodeURIComponent(email.trim())}`));
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Could not look up status.");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-md">
          <Link href={`/f/${slug}`} className="text-xs text-violet-600 hover:underline">← Back to application form</Link>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-bold text-slate-900">Check application status</h1>
            <p className="mt-2 text-sm text-slate-500 leading-6">
              Enter the email you used when applying. We&apos;ll show where you are in the process.
            </p>

            <form onSubmit={checkStatus} className="mt-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Email address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? "Checking…" : "Check status"}
              </button>
            </form>

            {result && (
              <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {!result.found ? (
                  <p className="text-sm text-slate-600">
                    No application found for that email{result.formTitle ? ` on "${result.formTitle}"` : ""}.
                    Double-check the address or apply using the form link.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">{result.formTitle}{result.companyName ? ` · ${result.companyName}` : ""}</p>
                    {result.applicantName && (
                      <p className="text-sm font-semibold text-slate-800">Hi {result.applicantName.split(/\s+/)[0]},</p>
                    )}
                    <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${STAGE_STYLE[result.stage || ""] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
                      {result.stageLabel}
                    </div>
                    {result.updatedAt && (
                      <p className="text-[11px] text-slate-400">
                        Last updated {new Date(result.updatedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 leading-5 pt-1">
                      {result.stage === "rejected"
                        ? "Thank you for applying. The team has moved forward with other candidates."
                        : result.stage === "hired"
                          ? "Congratulations! The team will be in touch with next steps."
                          : "The hiring team is reviewing applications. You'll hear from them if you're selected to move forward."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
