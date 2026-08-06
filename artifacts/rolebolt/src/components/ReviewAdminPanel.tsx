"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteReview,
  fetchReviews,
  updateReview,
  updateReviewSettings,
  type AdminReview,
  type AdminReviewSettings,
} from "@/lib/raka98Admin";

function Stars({ rating }: { rating: number }) {
  return <span className="text-[#f6b940]">{"★".repeat(rating)}<span className="text-white/20">{"★".repeat(5 - rating)}</span></span>;
}

function ReviewAdminCard({ item, onChange }: { item: AdminReview; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle(field: "featured" | "visible") {
    setBusy(true);
    setError("");
    try {
      await updateReview(item.id, { [field]: !item[field] });
      onChange();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not update review.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this review permanently?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteReview(item.id);
      onChange();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "Could not delete review.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white/90">{item.displayName} <span className="font-normal text-white/35">· Verified Job {item.role === "seeker" ? "Seeker" : "Creator"}</span></p>
          <p className="mt-1 text-sm"><Stars rating={item.rating} /></p>
        </div>
        <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[11px] text-red-300/75 hover:border-red-400/40 disabled:opacity-40">Delete</button>
      </div>
      {item.title && <h3 className="mt-4 text-sm font-semibold text-white/80">{item.title}</h3>}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">{item.message}</p>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/8 pt-4">
        <button type="button" disabled={busy} onClick={() => void toggle("featured")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${item.featured ? "border-[#5faef0] bg-[#5faef0]/15 text-[#9ed2ff]" : "border-white/10 text-white/45 hover:text-white/75"}`}>
          {item.featured ? "Featured by Rolebolt" : "Feature on landing page"}
        </button>
        <button type="button" disabled={busy} onClick={() => void toggle("visible")} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${item.visible ? "border-[#41d2a0]/30 bg-[#41d2a0]/10 text-[#73e2bd]" : "border-white/10 text-white/45 hover:text-white/75"}`}>
          {item.visible ? "Visible on reviews page" : "Hidden from reviews page"}
        </button>
      </div>
      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </article>
  );
}

export function ReviewAdminPanel() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [settings, setSettings] = useState<AdminReviewSettings>({ allowGuestReviews: false, showFeaturedReviews: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchReviews();
      setItems(result.reviews);
      setSettings(result.settings);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeSetting(field: keyof AdminReviewSettings) {
    setSavingSetting(true);
    try {
      const next = { [field]: !settings[field] };
      await updateReviewSettings(next);
      setSettings((current) => ({ ...current, ...next }));
    } catch (settingError: unknown) {
      setError(settingError instanceof Error ? settingError.message : "Could not update review setting.");
    } finally {
      setSavingSetting(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74d8ba]">Public voice</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white/90">Reviews</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/45">Choose which reviews appear on the landing page. Reviews are published immediately; you can hide or remove anything later.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="text-xs text-white/40 hover:text-white/70 disabled:opacity-40">Refresh</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {([
          ["showFeaturedReviews", "Show featured reviews on landing page", "When ON, only registered Job Seekers and Job Creators can submit reviews. When OFF, the landing banner is hidden and guests can submit reviews too."],
        ] as const).map(([field, label, hint]) => (
          <button key={field} type="button" disabled={savingSetting} onClick={() => void changeSetting(field)} className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:border-white/20 disabled:opacity-50">
            <span><span className="block text-sm font-semibold text-white/80">{label}</span><span className="mt-1 block text-xs leading-5 text-white/40">{hint}</span></span>
            <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${settings[field] ? "bg-[#41d2a0]" : "bg-white/15"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${settings[field] ? "left-6" : "left-1"}`} /></span>
          </button>
        ))}
      </div>
      {error && <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />)}</div> : items.length ? <div className="space-y-4">{items.map((item) => <ReviewAdminCard key={item.id} item={item} onChange={() => void load()} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-white/45">No reviews yet.</div>}
    </section>
  );
}