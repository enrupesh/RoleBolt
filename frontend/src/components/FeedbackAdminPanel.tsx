"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteFeedback,
  fetchFeedback,
  setFeedbackRead,
  type AdminFeedback,
  type FeedbackCategoryFilter,
  type FeedbackStatusFilter,
} from "@/lib/raka98Admin";

const CATEGORY_LABELS: Record<string, string> = {
  product: "Product experience",
  bug: "Bug report",
  feature: "Feature request",
  recruiter: "Recruiter workspace",
  job_seeker: "Job seeker experience",
  billing: "Billing & plans",
  other: "Something else",
};

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategoryFilter; label: string }> = [
  { value: "all", label: "All categories" },
  ...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value: value as FeedbackCategoryFilter, label })),
];

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function FeedbackCard({ item, onChange }: { item: AdminFeedback; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: "read" | "delete") {
    setBusy(true);
    setError("");
    try {
      if (action === "delete") {
        if (!window.confirm("Delete this feedback permanently?")) return;
        await deleteFeedback(item.id);
      } else {
        await setFeedbackRead(item.id, !item.readAt);
      }
      onChange();
    } catch (runError: unknown) {
      setError(runError instanceof Error ? runError.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`rounded-2xl border ${item.readAt ? "border-white/8 bg-white/[0.02]" : "border-[#41d2a0]/25 bg-[#41d2a0]/[0.05]"} overflow-hidden`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {!item.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-[#41d2a0] shadow-[0_0_10px_rgba(65,210,160,.8)]" aria-label="Unread" />}
          <div>
            <h3 className="text-sm font-semibold text-white/90">{CATEGORY_LABELS[item.category] || item.category}</h3>
            <p className="mt-1 text-xs text-white/35">{formatDate(item.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void run("read")} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] text-white/55 transition hover:border-white/25 hover:text-white disabled:opacity-40">
            {item.readAt ? "Mark unread" : "Mark read"}
          </button>
          <button type="button" disabled={busy} onClick={() => void run("delete")} className="rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[11px] text-red-300/75 transition hover:border-red-400/40 hover:text-red-200 disabled:opacity-40">Delete</button>
        </div>
      </div>
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[1fr_220px]">
        <p className="whitespace-pre-wrap text-sm leading-6 text-white/75">{item.message}</p>
        <div className="space-y-3 text-xs">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-white/30">Email</p>
            {item.email ? <a href={`mailto:${item.email}`} className="mt-1 block break-all text-blue-300 hover:text-blue-200">{item.email}</a> : <p className="mt-1 text-white/35">Not provided</p>}
          </div>
          {item.pageUrl && <div><p className="text-[10px] uppercase tracking-wide text-white/30">Sent from</p><p className="mt-1 break-all text-white/45">{item.pageUrl}</p></div>}
        </div>
      </div>
      {error && <p className="border-t border-red-400/15 bg-red-400/10 px-5 py-2.5 text-xs text-red-200">{error}</p>}
    </article>
  );
}

export function FeedbackAdminPanel() {
  const [category, setCategory] = useState<FeedbackCategoryFilter>("all");
  const [status, setStatus] = useState<FeedbackStatusFilter>("all");
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchFeedback(category, status);
      setItems(result.feedback);
      setUnreadCount(result.unreadCount);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load feedback.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74d8ba]">Product voice</p>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-white/90">Feedback inbox</h2>
            <span className="rounded-full border border-[#41d2a0]/20 bg-[#41d2a0]/10 px-2.5 py-1 text-[11px] font-semibold text-[#73e2bd]">{unreadCount} unread</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-white/45">Read what people are saying about Rolebolt and keep the product conversation in one place.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="text-xs text-white/40 transition hover:text-white/70 disabled:opacity-40">Refresh</button>
      </div>
      <div className="flex flex-wrap gap-2">
        <select value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategoryFilter)} className="rounded-full border border-white/10 bg-[#111118] px-3.5 py-2 text-xs text-white/70 outline-none focus:border-white/25">
          {CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {(["all", "unread", "read"] as FeedbackStatusFilter[]).map((item) => (
          <button key={item} type="button" onClick={() => setStatus(item)} className={`rounded-full border px-3.5 py-2 text-xs font-medium capitalize transition ${status === item ? "border-white bg-white text-black" : "border-white/10 text-white/45 hover:border-white/20 hover:text-white/70"}`}>{item}</button>
        ))}
      </div>
      {error && <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />)}</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center"><p className="text-sm text-white/50">No feedback matches this filter.</p></div> : <div className="space-y-4">{items.map((item) => <FeedbackCard key={item.id} item={item} onChange={() => void load()} />)}</div>}
    </section>
  );
}