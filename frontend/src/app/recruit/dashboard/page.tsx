"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, isFirebaseAvailable } from "@/lib/firebaseClient";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { RecruitGuard } from "@/components/RecruitGuard";

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
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://www.rolebolt.app"}/f/${form.slug}`;

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
              { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#25d366]", icon: "💬" },
              { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, color: "bg-[#1877f2]", icon: "f" },
              { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(form.title)}`, color: "bg-[#2aabee]", icon: "✈" },
              { name: "X / Twitter", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#000000]", icon: "𝕏" },
              { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`, color: "bg-[#0a66c2]", icon: "in" },
              { name: "Email", href: `mailto:?subject=${encodeURIComponent(`Apply: ${form.title}`)}&body=${encodeURIComponent(`${form.title}\n${link}`)}`, color: "bg-[#6366f1]", icon: "✉" },
              { name: "SMS", href: `sms:?&body=${encodeURIComponent(`Apply: ${form.title}\n${link}`)}`, color: "bg-[#10b981]", icon: "📱" },
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

  useEffect(() => {
    if (!isFirebaseAvailable()) return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) { const t = await u.getIdToken(); setToken(t); }
      else router.push("/recruit/login");
    });
    return () => unsub();
  }, [router]);

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

  const stats = [
    { label: "Active Roles",      value: activeJobs,                                                                              accent: "text-emerald-600", bar: "from-emerald-400 to-emerald-500", sub: "hiring now"          },
    { label: "Total Candidates",  value: pipeline?.total ?? jobs.reduce((s, j) => s + (j.candidateCount || 0), 0),                accent: "text-blue-600",   bar: "from-blue-400 to-blue-600",     sub: "in pipeline"         },
    { label: "Shortlisted",       value: pipeline?.shortlisted ?? 0,                                                              accent: "text-violet-600", bar: "from-violet-400 to-violet-600", sub: "screened + assessed"  },
    { label: "Interview",         value: pipeline?.interview ?? 0,                                                                 accent: "text-amber-600",  bar: "from-amber-400 to-amber-500",   sub: "at interview stage"  },
    { label: "Hired",             value: pipeline?.hired ?? 0,                                                                    accent: "text-teal-600",   bar: "from-teal-400 to-teal-500",     sub: "all time"            },
    { label: "Form Responses",    value: forms.reduce((s, f) => s + (f.responseCount || 0), 0),                                   accent: "text-violet-500", bar: "from-purple-400 to-violet-500", sub: "via custom forms"    },
  ];

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
            <img src="/plyndrox-icon.png" alt="Rolebolt" className="h-9 w-9 rounded-xl object-cover shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.12)]" />
            <span>
              <span className="block text-[15px] font-bold text-slate-900 leading-none tracking-tight">Rolebolt</span>
              <span className="block text-[10px] font-semibold text-slate-400 mt-0.5 tracking-widest uppercase">Dashboard</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-0.5">
            <Link href="/recruit/talent-pool"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              <UsersIcon /> Talent Pool
            </Link>
            <Link href="/recruit/analytics"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              <BarChartIcon /> Analytics
            </Link>
            <Link href="/recruit/recruiter-profile"
              className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition">
              Profile
            </Link>
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
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900 leading-tight">Recruitment Pipeline</h1>
          <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">Manage all your open roles and candidate pipelines from one place.</p>
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-8">
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
            {/* Example roles */}
            <div className="mb-5 flex flex-wrap items-center gap-1.5">
              {["Large Companies", "Corporate Hiring", "Enterprise Recruitment", "Structured Teams"].map(ex => (
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
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading jobs…
                </div>
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
              {["Script Writer", "Video Editor", "Content Creator", "Graphic Designer"].map(ex => (
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
              <div className="flex items-center justify-center py-24">
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading forms…
                </div>
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
        <div className="mt-8 md:hidden flex flex-wrap gap-2">
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
          <Link href="/recruit/recruiter-profile"
            className="flex items-center gap-1.5 rounded-xl bg-white border border-black/[0.06] px-4 py-2.5 text-[12px] font-medium text-slate-700
              shadow-[0_1px_3px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] hover:-translate-y-px transition">
            Profile
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function RecruitDashboardPage() {
  return <RecruitGuard requiredRole="creator"><RecruitDashboardContent /></RecruitGuard>;
}
