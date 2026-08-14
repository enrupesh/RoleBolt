"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { useBillingEntitlements } from "@/contexts/BillingEntitlementContext";
import { apiUrl, readApiJson } from "@/lib/api";
import { displayHandle } from "@/lib/username";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SkStatCard, SkJobCard } from "@/components/Skeleton";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import PostCreateChecklist from "@/components/PostCreateChecklist";
import { ReviewModal } from "@/components/ReviewModal";
import { isJudgeReviewerEmail } from "@/lib/judgeReviewer";
import { openJudgeWelcomeModal } from "@/lib/judgeWelcome";
import { ensureSeekerProfileReady } from "@/lib/ensureSeekerProfileReady";

type Job = {
  _id: string;
  title: string;
  department: string;
  seniority: string;
  location: string;
  workMode: string;
  status: "active" | "paused" | "closed";
  candidateCount: number;
  createdAt: string;
  agentMode?: { enabled?: boolean };
};

type Form = {
  _id: string;
  title: string;
  description: string;
  slug: string;
  status: "active" | "closed";
  responseCount: number;
  createdAt: string;
};

function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="M12 5v14" />
    </svg>
  );
}

function BriefcaseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

function FormIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}

function ShareIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>
    </svg>
  );
}

function SparklesIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
    </svg>
  );
}

function UsersIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function DeleteJobModal({ job, token, onClose, onDeleted }: { job: Job; token: string; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!token) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${job._id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await readApiJson(res);
        throw new Error(data.error || "Failed to delete job.");
      }
      onDeleted(job._id);
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Delete this job?</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">{job.title}</span> and all its candidates will be permanently removed. This cannot be undone.
          </p>
          {error && <p className="mt-3 text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || !token}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
          >
            {deleting ? (
              <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Deleting…</>
            ) : (
              "Delete Job"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function BarChartIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" />
      <line x1="18" x2="18" y1="20" y2="4" />
      <line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  );
}

const STATUS_MAP = {
  active: { pill: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500", label: "Active" },
  paused: { pill: "bg-amber-50 text-amber-700 border border-amber-200", dot: "bg-amber-500", label: "Paused" },
  closed: { pill: "bg-slate-100 text-slate-500 border border-slate-200", dot: "bg-slate-400", label: "Closed" },
};

const WORK_MODE_LABELS: Record<string, string> = {
  remote: "Remote", onsite: "On-site", hybrid: "Hybrid",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const SEEN_COUNTS_KEY = "recruit_dashboard_seen_counts";
function loadSeenCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_COUNTS_KEY) || "{}"); } catch { return {}; }
}
function saveSeenCounts(counts: Record<string, number>) {
  try { localStorage.setItem(SEEN_COUNTS_KEY, JSON.stringify(counts)); } catch {}
}

type PipelineSummary = {
  total: number;
  shortlisted: number;
  interview: number;
  hired: number;
  offer: number;
};

function CopyShareModal({ form, onClose }: { form: Form; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.tech"}/f/${form.slug}`;

  function copy() {
    navigator.clipboard.writeText(link).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Share form</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">{form.title}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-700 transition">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="flex-1 text-xs text-slate-600 truncate font-mono">{link}</p>
            <button onClick={copy} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${copied ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}`}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#25d366]", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
              { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, color: "bg-[#1877f2]", icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
              { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(form.title)}`, color: "bg-[#2aabee]", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
              { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#000000]", icon: <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
              { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, color: "bg-[#0a66c2]", icon: <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg> },
              { name: "Email", href: `mailto:?subject=${encodeURIComponent(`Apply: ${form.title}`)}&body=${encodeURIComponent(`${form.title}\n${link}`)}`, color: "bg-[#6366f1]", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> },
              { name: "SMS", href: `sms:?&body=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#10b981]", icon: <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7a2 2 0 0 1 1.72 2.02z"/></svg> },
            ].map(s => (
              <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer"
                className={`flex flex-col items-center gap-1 rounded-xl p-2.5 text-white transition hover:opacity-90 active:scale-95 ${s.color}`} title={s.name}>
                <span className="text-base leading-none">{s.icon}</span>
                <span className="text-[9px] font-bold leading-none">{s.name.split(" ")[0]}</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteFormModal({ form, token, onClose, onDeleted }: { form: Form; token: string; onClose: () => void; onDeleted: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${form._id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await readApiJson(res);
        throw new Error(data.error || "Failed to delete form.");
      }
      onDeleted(form._id);
      onClose();
    } catch (e: any) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !deleting) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-6 pb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 border border-rose-100 mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </div>
          <h2 className="text-base font-bold text-slate-900 mb-1">Delete this form?</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            <span className="font-semibold text-slate-700">{form.title}</span> and all its responses will be permanently removed. This cannot be undone.
          </p>
          {error && <p className="mt-3 text-xs text-rose-600 font-medium">{error}</p>}
        </div>
        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={deleting}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
          >
            {deleting ? (
              <><svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Deleting…</>
            ) : (
              "Delete Form"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecruitDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [token, setToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"jobs" | "forms">(tabParam === "forms" ? "forms" : "jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "paused" | "closed">("all");
  const [formFilter, setFormFilter] = useState<"all" | "active" | "closed">("all");
  const [seenCounts, setSeenCounts] = useState<Record<string, number>>({});
  const [pipeline, setPipeline] = useState<PipelineSummary | null>(null);
  const [shareForm, setShareForm] = useState<Form | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);

  const { sessionToken, authUser, recruitProfile } = useRecruitAuth();
  const isJudgeReviewer =
    isJudgeReviewerEmail(authUser?.email) &&
    recruitProfile?.canAccessSeeker === true;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [seekerNavLoading, setSeekerNavLoading] = useState(false);

  async function openSeekerDashboard() {
    if (!sessionToken || seekerNavLoading) return;
    setSeekerNavLoading(true);
    try {
      await ensureSeekerProfileReady(sessionToken, {
        email: authUser?.email,
        username: authUser?.username,
      });
      router.push("/seeker/dashboard");
    } finally {
      setSeekerNavLoading(false);
    }
  }
  useEffect(() => {
    if (sessionToken) setToken(sessionToken);
  }, [sessionToken]);

  useEffect(() => { setSeenCounts(loadSeenCounts()); }, []);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [jobsRes, pipelineRes, formsRes] = await Promise.all([
        fetch(apiUrl("/recruit/jobs"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/recruit/pipeline-summary"), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(apiUrl("/recruit/forms"), { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const jobsData = await readApiJson(jobsRes);
      setJobs(jobsData.jobs ?? []);
      if (pipelineRes.ok) {
        const pd = await readApiJson(pipelineRes);
        setPipeline(pd);
      }
      if (formsRes.ok) {
        const fd = await readApiJson(formsRes);
        setForms(fd.forms ?? []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [token]);

  function markJobSeen(jobId: string, count: number) {
    const updated = { ...seenCounts, [jobId]: count };
    setSeenCounts(updated);
    saveSeenCounts(updated);
  }

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredJobs = jobs.filter(j => filter === "all" || j.status === filter);
  const filteredForms = forms.filter(f => formFilter === "all" || f.status === formFilter);
  const activeJobs = jobs.filter(j => j.status === "active").length;

  // Standard Jobs-only stats (pipeline, roles, hiring funnel)
  const jobStats = [
    { label: "Active Roles",      value: activeJobs,                                                                              accent: "text-emerald-600", bar: "from-emerald-400 to-emerald-500", sub: "hiring now"          },
    { label: "Total Candidates",  value: pipeline?.total ?? jobs.reduce((s, j) => s + (j.candidateCount || 0), 0),                accent: "text-blue-600",   bar: "from-blue-400 to-blue-600",     sub: "in pipeline"         },
    { label: "Shortlisted",       value: pipeline?.shortlisted ?? 0,                                                              accent: "text-violet-600", bar: "from-violet-400 to-violet-600", sub: "screened + assessed"  },
    { label: "Interview",         value: pipeline?.interview ?? 0,                                                                 accent: "text-amber-600",  bar: "from-amber-400 to-amber-500",   sub: "at interview stage"  },
    { label: "Hired",             value: pipeline?.hired ?? 0,                                                                    accent: "text-teal-600",   bar: "from-teal-400 to-teal-500",     sub: "all time"            },
  ];

  // Form Jobs-only stats
  const formStats = [
    { label: "Active Forms",      value: forms.filter(f => f.status === "active").length,                                        accent: "text-emerald-600", bar: "from-emerald-400 to-emerald-500", sub: "collecting now"      },
    { label: "Form Responses",    value: forms.reduce((s, f) => s + (f.responseCount || 0), 0),                                   accent: "text-violet-500", bar: "from-purple-400 to-violet-500", sub: "via custom forms"    },
  ];

  const stats = activeTab === "jobs" ? jobStats : formStats;

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {shareForm && <CopyShareModal form={shareForm} onClose={() => setShareForm(null)} />}
      {jobToDelete && token && (
        <DeleteJobModal
          job={jobToDelete}
          token={token}
          onClose={() => setJobToDelete(null)}
          onDeleted={(id) => setJobs(prev => prev.filter(j => j._id !== id))}
        />
      )}
      {formToDelete && token && (
        <DeleteFormModal
          form={formToDelete}
          token={token}
          onClose={() => setFormToDelete(null)}
          onDeleted={(id) => setForms(prev => prev.filter(f => f._id !== id))}
        />
      )}

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-black/[0.07] shadow-[0_1px_0_rgba(0,0,0,0.04),0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/recruit" className="flex items-center gap-3">
            <RoleboltLogo size="lg" />
            <span>
              <span className="block text-[15px] font-bold text-slate-900 leading-none tracking-tight">Rolebolt</span>
              <span className="block text-[10px] font-semibold text-slate-400 mt-0.5 tracking-widest uppercase">Dashboard</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            {activeTab === "jobs" && (
              <>
                <Link href="/recruit/talent-pool"
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
                  <UsersIcon /> Talent Pool
                </Link>
                <Link href="/recruit/analytics"
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
                  <BarChartIcon /> Analytics
                </Link>
                <div className="relative ml-1">
                  <span className="rb-golden-tag absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[8.5px] font-extrabold uppercase tracking-wide text-amber-900">
                    ✨ Made for Standard Jobs
                  </span>
                  <Link href="/recruit/copilot?workspace=standard"
                    className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
                    <SparklesIcon /> Hiring Copilot
                  </Link>
                </div>
              </>
            )}
            {activeTab === "forms" && (
              <div className="relative ml-1">
                <span className="rb-golden-tag absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[8.5px] font-extrabold uppercase tracking-wide text-amber-900">
                  ✨ Made for Form Jobs
                </span>
                <Link href="/recruit/copilot?workspace=form"
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
                  <SparklesIcon /> Hiring Copilot
                </Link>
              </div>
            )}
            <Link href="/recruit/recruiter-profile"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              Profile
            </Link>
            {isJudgeReviewer && (
              <button
                type="button"
                onClick={() => openJudgeWelcomeModal()}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] font-semibold text-amber-900 transition hover:bg-amber-100"
              >
                <span aria-hidden="true">★</span>
                Judge guide
              </button>
            )}
          </nav>

          <Link href="/recruit/new"
            className="flex items-center gap-1.5 rounded-xl bg-[#0a66c2] px-4 py-2.5 text-[13px] font-semibold text-white transition
              shadow-[0_2px_8px_rgba(10,102,194,0.30)]
              hover:bg-blue-700 hover:shadow-[0_4px_16px_rgba(10,102,194,0.40)] hover:-translate-y-px">
            <PlusIcon /> Create New
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* ── Page title ────────────────────────────────────────────────── */}
        <div className="mb-8">
          <p className="text-sm font-medium text-slate-500 mb-1">
            Hey {displayHandle(authUser ?? recruitProfile)}!
          </p>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 leading-tight">
            {activeTab === "jobs" ? "Recruitment Pipeline" : "Form Jobs"}
          </h1>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
            {activeTab === "jobs"
              ? "Manage all your open roles and candidate pipelines from one place."
              : "Collect and screen applicants through custom forms, without a full pipeline."}
          </p>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:border-indigo-300 hover:text-indigo-600"
          >
            Write a review
          </button>
          {isJudgeReviewer && (
            <>
              <button
                type="button"
                onClick={() => openJudgeWelcomeModal()}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
              >
                <span aria-hidden="true">★</span>
                Judge guide
              </button>
              <button
                type="button"
                onClick={() => void openSeekerDashboard()}
                disabled={seekerNavLoading}
                className="mt-4 ml-2 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {seekerNavLoading ? "Opening seeker workspace…" : "Explore Job Seeker Features"}
                {!seekerNavLoading && <span aria-hidden="true">→</span>}
              </button>
            </>
          )}
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        {loading ? (
          <div className={`grid grid-cols-2 gap-3 mb-8 ${activeTab === "jobs" ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-2 max-w-md"} animate-[rb-fade-in_0.3s_ease_both]`}>
            {Array.from({ length: activeTab === "jobs" ? 5 : 2 }).map((_, i) => <SkStatCard key={i} />)}
          </div>
        ) : (
          <div className={`grid grid-cols-2 gap-3 mb-8 ${activeTab === "jobs" ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-2 max-w-md"} animate-[rb-fade-in_0.3s_ease_both]`}>
            {stats.map(s => (
              <div key={s.label} className="relative overflow-hidden rounded-2xl bg-white border border-black/[0.06] p-4
                shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]">
                {/* colored top accent strip */}
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.bar}`} />
                <p className={`text-[26px] font-bold leading-none tabular-nums mt-1 ${s.accent}`}>{s.value}</p>
                <p className="mt-2 text-[11px] font-semibold text-slate-800 leading-snug">{s.label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-none">{s.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Upgrade nudge (free plan) ─────────────────────────────────── */}
        <UpgradeNudge />

        {/* ── Daily Briefing card ───────────────────────────────────────── */}
        <DailyBriefingCard />

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex items-stretch gap-1.5 mb-6 bg-white rounded-2xl p-1.5
          border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_12px_rgba(0,0,0,0.04)]">
          <button
            onClick={() => setActiveTab("jobs")}
            className={`flex flex-1 flex-col items-start gap-1 rounded-xl px-4 py-2.5 text-left transition-all ${
              activeTab === "jobs"
                ? "bg-[#0a66c2] text-white shadow-[0_2px_8px_rgba(10,102,194,0.35)]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
              activeTab === "jobs" ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700 border border-amber-200/80"
            }`}>
              🏷 Big Business
            </span>
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <BriefcaseIcon size={14} />
              Standard Jobs
              {jobs.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${activeTab === "jobs" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {jobs.length}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("forms")}
            className={`flex flex-1 flex-col items-start gap-1 rounded-xl px-4 py-2.5 text-left transition-all ${
              activeTab === "forms"
                ? "bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.35)]"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
              activeTab === "forms" ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700 border border-amber-200/80"
            }`}>
              🏷 Small Business
            </span>
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <FormIcon size={14} />
              Form Jobs
              {forms.length > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${activeTab === "forms" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                  {forms.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {/* ── Standard Jobs tab ─────────────────────────────────────────── */}
        {activeTab === "jobs" && (
          <>
            <PostCreateChecklist jobs={jobs} />

            {/* Example roles */}
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {["Large Companies", "Corporate Hiring", "Enterprise Recruitment", "Structured Teams", "etc."].map(ex => (
                <span key={ex} className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">{ex}</span>
              ))}
            </div>

            {/* Filter row */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {(["all", "active", "paused", "closed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-[12px] font-semibold capitalize transition ${
                    filter === f
                      ? "bg-[#0a66c2] text-white shadow-[0_2px_8px_rgba(10,102,194,0.30)]"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {f === "all" ? "All Jobs" : f}
                </button>
              ))}
              <span className="ml-auto text-[12px] font-medium text-slate-400">{filteredJobs.length} role{filteredJobs.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-[rb-fade-in_0.3s_ease_both]">
                {Array.from({ length: 6 }).map((_, i) => <SkJobCard key={i} />)}
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-300 mb-5
                  shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <BriefcaseIcon size={30} />
                </div>
                <h2 className="text-base font-semibold text-slate-800">
                  {filter === "all" ? "No jobs yet" : `No ${filter} jobs`}
                </h2>
                <p className="mt-2 text-[13px] text-slate-500 max-w-xs leading-relaxed">
                  {filter === "all"
                    ? "Post your first job and let AI generate the full description and scoring rubric in 30 seconds."
                    : `You don't have any ${filter} jobs right now.`}
                </p>
                {filter === "all" && (
                  <Link href="/recruit/jobs/new"
                    className="mt-6 flex items-center gap-2 rounded-xl bg-[#0a66c2] px-6 py-2.5 text-sm font-semibold text-white
                      shadow-[0_2px_8px_rgba(10,102,194,0.30)] hover:bg-blue-700 hover:shadow-[0_4px_16px_rgba(10,102,194,0.40)] hover:-translate-y-px transition">
                    <PlusIcon /> Post First Job
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredJobs.map(job => {
                  const s = STATUS_MAP[job.status] ?? STATUS_MAP.closed;
                  const lastSeen = seenCounts[job._id] ?? 0;
                  const newCount = Math.max(0, (job.candidateCount || 0) - lastSeen);
                  const hasNew = newCount > 0 && lastSeen > 0;

                  return (
                    <div
                      key={job._id}
                      className="group relative flex flex-col rounded-2xl bg-white border border-black/[0.06] p-5 transition-all duration-200
                        shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
                        hover:shadow-[0_8px_28px_rgba(0,0,0,0.11),0_1px_4px_rgba(0,0,0,0.06)]
                        hover:-translate-y-0.5"
                    >
                      {/* Blue top-accent on hover */}
                      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-blue-500 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 text-blue-600 border border-blue-100/80">
                          <BriefcaseIcon size={18} />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          {hasNew && (
                            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_1px_4px_rgba(10,102,194,0.35)]">
                              +{newCount} new
                            </span>
                          )}
                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setJobToDelete(job); }}
                            title="Delete job"
                            className="flex items-center justify-center h-6 w-6 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>

                      <Link
                        href={`/recruit/jobs/${job._id}`}
                        onClick={() => markJobSeen(job._id, job.candidateCount || 0)}
                        className="block"
                      >
                        <h3 className="text-[15px] font-semibold text-slate-900 group-hover:text-blue-700 transition line-clamp-1 mb-0.5 leading-snug">
                          {job.title}
                        </h3>
                        <p className="text-[12px] text-slate-400 font-medium">
                          {job.seniority}{job.department ? ` · ${job.department}` : ""}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-400">
                          <span className="flex items-center gap-1"><MapPinIcon /> {job.location}</span>
                          <span>{WORK_MODE_LABELS[job.workMode] ?? job.workMode}</span>
                        </div>
                      </Link>

                      <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                        <Link
                          href={`/recruit/jobs/${job._id}`}
                          onClick={() => markJobSeen(job._id, job.candidateCount || 0)}
                          className={`flex items-center gap-1.5 text-[12px] font-semibold ${hasNew ? "text-blue-600" : "text-slate-500"} hover:text-blue-600 transition`}
                        >
                          <UsersIcon /> {job.candidateCount || 0} candidate{job.candidateCount !== 1 ? "s" : ""}
                        </Link>
                        <Link
                          href={`/recruit/jobs/${job._id}`}
                          onClick={() => markJobSeen(job._id, job.candidateCount || 0)}
                          className="flex items-center gap-0.5 text-[12px] text-slate-400 hover:text-blue-600 transition"
                        >
                          {timeAgo(job.createdAt)}
                          <ChevronRightIcon />
                        </Link>
                      </div>
                    </div>
                  );
                })}

                {/* Add new job card */}
                <Link
                  href="/recruit/jobs/new"
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/80 bg-white/40 p-8 text-center
                    hover:border-blue-300 hover:bg-blue-50/30 transition-all duration-200
                    shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-500 group-hover:bg-blue-50 transition-all mb-3">
                    <PlusIcon />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-500 group-hover:text-blue-700 transition">New Job Posting</p>
                  <p className="mt-1 text-[11px] text-slate-400">AI generates the JD in 30 seconds</p>
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── Form Jobs tab ──────────────────────────────────────────────── */}
        {activeTab === "forms" && (
          <>
            {/* Example roles */}
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {["Vlogger", "YouTuber", "Influencer", "Podcaster", "Freelancer", "Small Business", "etc."].map(ex => (
                <span key={ex} className="rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">{ex}</span>
              ))}
            </div>

            {/* Filter row */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {(["all", "active", "closed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormFilter(f)}
                  className={`rounded-full px-4 py-1.5 text-[12px] font-semibold capitalize transition ${
                    formFilter === f
                      ? "bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.30)]"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  }`}
                >
                  {f === "all" ? "All Forms" : f}
                </button>
              ))}
              <span className="ml-auto text-[12px] font-medium text-slate-400">{filteredForms.length} form{filteredForms.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-[rb-fade-in_0.3s_ease_both]">
                {Array.from({ length: 6 }).map((_, i) => <SkJobCard key={i} />)}
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-300 mb-5
                  shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
                  <FormIcon size={30} />
                </div>
                <h2 className="text-base font-semibold text-slate-800">
                  {formFilter === "all" ? "No forms yet" : `No ${formFilter} forms`}
                </h2>
                <p className="mt-2 text-[13px] text-slate-500 max-w-xs leading-relaxed">
                  {formFilter === "all"
                    ? "Build a custom application form, share the link, and AI scores every response automatically."
                    : `No ${formFilter} forms right now.`}
                </p>
                {formFilter === "all" && (
                  <Link href="/recruit/forms/new"
                    className="mt-6 flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white
                      shadow-[0_2px_8px_rgba(124,58,237,0.30)] hover:bg-violet-700 hover:shadow-[0_4px_16px_rgba(124,58,237,0.40)] hover:-translate-y-px transition">
                    <PlusIcon /> Build First Form
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredForms.map(form => {
                  const isActive = form.status === "active";
                  return (
                    <div key={form._id} className="group relative flex flex-col rounded-2xl bg-white border border-black/[0.06] p-5 transition-all duration-200
                      shadow-[0_1px_3px_rgba(0,0,0,0.05),0_4px_16px_rgba(0,0,0,0.04)]
                      hover:shadow-[0_8px_28px_rgba(0,0,0,0.11),0_1px_4px_rgba(0,0,0,0.06)]
                      hover:-translate-y-0.5">
                      {/* Violet top-accent on hover */}
                      <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-2xl bg-gradient-to-r from-violet-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 border border-violet-100/80">
                          <FormIcon size={18} />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {isActive ? "Active" : "Closed"}
                          </span>
                          <button
                            onClick={e => { e.stopPropagation(); setFormToDelete(form); }}
                            title="Delete form"
                            className="flex items-center justify-center h-6 w-6 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>

                      <Link href={`/recruit/forms/${form._id}`}>
                        <h3 className="text-[15px] font-semibold text-slate-900 group-hover:text-violet-700 transition line-clamp-2 mb-1 leading-snug">
                          {form.title}
                        </h3>
                      </Link>
                      {form.description && (
                        <p className="text-[12px] text-slate-400 line-clamp-1 mb-2 leading-relaxed">{form.description}</p>
                      )}

                      <div className="mt-auto pt-3.5 border-t border-slate-100 flex items-center justify-between">
                        <Link href={`/recruit/forms/${form._id}`} className="flex items-center gap-1.5 text-[12px] font-semibold text-violet-600 hover:text-violet-800 transition">
                          <UsersIcon size={12} />
                          {form.responseCount || 0} response{form.responseCount !== 1 ? "s" : ""}
                        </Link>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12px] text-slate-400">{timeAgo(form.createdAt)}</span>
                          <button
                            onClick={e => { e.stopPropagation(); setShareForm(form); }}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600
                              hover:bg-violet-50 hover:border-violet-200 hover:text-violet-600 transition"
                            title="Share form"
                          >
                            <ShareIcon size={10} /> Share
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add new form card */}
                <Link
                  href="/recruit/forms/new"
                  className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200/80 bg-white/40 p-8 text-center
                    hover:border-violet-300 hover:bg-violet-50/30 transition-all duration-200
                    shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 group-hover:border-violet-400 group-hover:text-violet-500 group-hover:bg-violet-50 transition-all mb-3">
                    <PlusIcon />
                  </div>
                  <p className="text-[13px] font-semibold text-slate-500 group-hover:text-violet-700 transition">New Form</p>
                  <p className="mt-1 text-[11px] text-slate-400">Share & let AI score responses</p>
                </Link>
              </div>
            )}
          </>
        )}

        {/* ── Mobile quick-nav ──────────────────────────────────────────── */}
        {/* ── Mobile quick-links ───────────────────────────────────────── */}
        <div className="mt-8 md:hidden flex flex-wrap gap-2">
          {activeTab === "jobs" && (
            <>
              <Link href="/recruit/talent-pool"
                className="flex items-center gap-1.5 rounded-xl bg-white border border-black/[0.06] px-4 py-2.5 text-[12px] font-medium text-slate-700
                  shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px transition">
                <UsersIcon /> Talent Pool
              </Link>
              <Link href="/recruit/analytics"
                className="flex items-center gap-1.5 rounded-xl bg-white border border-black/[0.06] px-4 py-2.5 text-[12px] font-medium text-slate-700
                  shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px transition">
                <BarChartIcon /> Analytics
              </Link>
            </>
          )}
          <Link href="/recruit/recruiter-profile"
            className="flex items-center gap-1.5 rounded-xl bg-white border border-black/[0.06] px-4 py-2.5 text-[12px] font-medium text-slate-700
              shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px transition">
            Profile
          </Link>
        </div>
      </main>
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

// ── Upgrade Nudge (free plan banner) ─────────────────────────────────────────
function UpgradeNudge() {
  const { getEntitlement, loading } = useBillingEntitlements();
  const entitlement = getEntitlement("creator_standard");

  if (loading) return null;
  if (!entitlement || entitlement.plan !== "free") return null;

  return (
    <div className="mb-6 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 px-5 py-4 flex items-center justify-between gap-4 shadow-[0_1px_3px_rgba(15,118,110,0.08)]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl shrink-0">⚡</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-teal-950">You&rsquo;re on Standard Jobs Free</p>
          <p className="text-xs text-teal-800 mt-0.5 leading-snug">
            Upgrade to Pro for higher AI capacity, more active jobs, Pipeline Rules, and priority processing.
          </p>
        </div>
      </div>
      <a
        href="/recruit/pricing?category=creator_standard"
        className="shrink-0 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition shadow-[0_2px_8px_rgba(15,118,110,0.35)]"
      >
        Upgrade →
      </a>
    </div>
  );
}

// ── Daily Briefing Card ───────────────────────────────────────────────────────
function DailyBriefingCard() {
  const { sessionToken } = useRecruitAuth();
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);

  useEffect(() => {
    if (!infoOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setInfoOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [infoOpen]);

  async function sendNow() {
    if (!sessionToken) return;
    setSending(true);
    setStatus("idle");
    try {
      const requestKey = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `daily_briefing_${crypto.randomUUID()}`
        : `daily_briefing_${Date.now()}`;
      const res = await fetch(apiUrl("/recruit/briefing/send-now"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Idempotency-Key": requestKey,
        },
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Failed to send briefing.");
      setMsg(data.message || "Briefing sent! Check your inbox.");
      setStatus("success");
    } catch (e: any) {
      setMsg(e.message || "Something went wrong.");
      setStatus("error");
    } finally {
      setSending(false);
      setTimeout(() => setStatus("idle"), 5000);
    }
  }

  return (
    <>
      <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white shadow shadow-indigo-500/25">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">AI Daily Briefing</p>
            <p className="text-xs text-slate-500">A clear hiring summary sent to your inbox, ready when you need it.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {status === "success" && <p className="text-xs font-medium text-emerald-600">{msg}</p>}
          {status === "error"   && <p className="text-xs font-medium text-rose-600">{msg}</p>}
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="shrink-0 rounded-xl bg-indigo-500 px-4 py-2 text-xs font-bold text-white shadow shadow-indigo-500/20 transition hover:bg-indigo-400"
          >
            Send today's briefing now
          </button>
        </div>
      </div>

      {infoOpen && (
        <div
          className="rb-daily-briefing-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setInfoOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="daily-briefing-title"
            className="rb-daily-briefing-sheet w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:rounded-3xl"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-6 pb-5 pt-6 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">Your daily overview</p>
                    <h2 id="daily-briefing-title" className="mt-1 text-xl font-bold tracking-tight text-slate-900">Daily Briefing</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  aria-label="Close Daily Briefing information"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-700"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Daily Briefing sends you a useful summary by email, making your daily hiring information easier to understand and review.
              </p>
            </div>

            <div className="space-y-5 px-6 py-6 sm:px-7">
              <div>
                <h3 className="text-sm font-bold text-slate-900">How it works</h3>
                <div className="mt-3 space-y-3">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">1</span>
                    <p className="pt-0.5 text-sm leading-5 text-slate-600">Get a simple summary of the hiring activity that matters most.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">2</span>
                    <p className="pt-0.5 text-sm leading-5 text-slate-600">Review it in your inbox whenever you are ready to plan your day.</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">3</span>
                    <p className="pt-0.5 text-sm leading-5 text-slate-600">Choose manual delivery or automatic delivery based on your plan.</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold text-slate-800">Free &amp; Pro Plans</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Send your briefing manually whenever you want to receive it.</p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
                  <p className="text-xs font-bold text-indigo-900">Ultra Pro Plan</p>
                  <p className="mt-1 text-xs leading-5 text-indigo-700">Eligible users can receive it automatically every day at 8:00 AM.</p>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-amber-800">Note</p>
                <p className="mt-1.5 text-sm leading-5 text-amber-950">
                  <strong>Free Plan &amp; Pro Plan:</strong> The Daily Briefing email must be sent manually by you. These plans do not receive the briefing automatically.
                </p>
                <p className="mt-2 text-sm leading-5 text-amber-950">
                  <strong>Ultra Pro Plan:</strong> The Daily Briefing service works automatically, so eligible Ultra Pro users can receive the briefing without sending it manually.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setInfoOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  Not now
                </button>
                <button
                  type="button"
                  onClick={sendNow}
                  disabled={sending}
                  className="rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-bold text-white shadow shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-60"
                >
                  {sending ? "Sending…" : "Send Daily Briefing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function RecruitDashboardPage() {
  return <RecruitGuard requiredRole="creator"><RecruitDashboardContent /></RecruitGuard>;
}
