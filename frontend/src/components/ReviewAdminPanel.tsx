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

function planLabel(plan?: AdminReview["submitterPlan"]) {
  if (!plan) return "Unknown";
  if (plan === "ultra") return "Ultra Pro";
  if (plan === "pro") return "Pro";
  return "Free";
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
    <article className={`rounded-2xl border p-5 ${item.videoUrl ? "border-[#5faef0]/25 bg-[#5faef0]/[0.04]" : "border-white/8 bg-white/[0.02]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white/90">{item.displayName} <span className="font-normal text-white/35">· Verified Job {item.role === "seeker" ? "Seeker" : "Creator"}</span></p>
            {item.videoUrl ? (
              <span className="rounded-full border border-[#5faef0]/30 bg-[#5faef0]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9ed2ff]">
                Video review
              </span>
            ) : null}
            {item.videoUrl && !item.visible ? (
              <span className="rounded-full border border-[#f0d9a8]/30 bg-[#f0d9a8]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#f0d9a8]">
                Pending approval
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm"><Stars rating={item.rating} /></p>
          {item.videoUrl ? (
            <div className="mt-2 space-y-1 text-xs text-white/45">
              {item.email ? <p>Email: <span className="text-white/70">{item.email}</span></p> : null}
              {item.role === "seeker" ? <p>Seeker plan: <span className="text-white/70">{planLabel(item.submitterPlan)}</span></p> : null}
              {item.createdAt ? <p>Submitted: <span className="text-white/70">{new Date(item.createdAt).toLocaleString()}</span></p> : null}
            </div>
          ) : null}
        </div>
        <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[11px] text-red-300/75 hover:border-red-400/40 disabled:opacity-40">Delete</button>
      </div>
      {item.videoUrl ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">Public video link</p>
          <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-sm font-medium text-[#9ed2ff] hover:underline">
            {item.videoUrl}
          </a>
          <p className="mt-3 text-xs leading-5 text-white/40">
            Review the video manually and decide whether it qualifies for a reward tier (2×, 1.5×, or 0.5×). Approve by making it visible on the reviews page.
          </p>
        </div>
      ) : null}
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
  const [settings, setSettings] = useState<AdminReviewSettings>({
    allowGuestReviews: false,
    showFeaturedReviews: true,
    featuredXPostUrls: [],
    savedFeaturedXPostUrls: [],
    featuredVideoReviewUrls: [],
    savedFeaturedVideoReviewUrls: [],
  });
  const [xPostDraft, setXPostDraft] = useState("");
  const [videoReviewDraft, setVideoReviewDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingSetting, setSavingSetting] = useState(false);
  const [savingXPosts, setSavingXPosts] = useState(false);
  const [savingVideoReviews, setSavingVideoReviews] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchReviews();
      setItems(result.reviews);
      setSettings(result.settings);
      const saved = result.settings.savedFeaturedXPostUrls ?? [];
      setXPostDraft(saved.join("\n"));
      const savedVideos = result.settings.savedFeaturedVideoReviewUrls ?? [];
      setVideoReviewDraft(savedVideos.join("\n"));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeSetting(field: keyof Pick<AdminReviewSettings, "allowGuestReviews" | "showFeaturedReviews">) {
    setSavingSetting(true);
    try {
      const next = { [field]: !settings[field] };
      const data = await updateReviewSettings(next);
      setSettings(data);
    } catch (settingError: unknown) {
      setError(settingError instanceof Error ? settingError.message : "Could not update review setting.");
    } finally {
      setSavingSetting(false);
    }
  }

  async function saveXPosts() {
    setSavingXPosts(true);
    setError("");
    try {
      const urls = xPostDraft
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const data = await updateReviewSettings({ featuredXPostUrls: urls });
      setSettings(data);
      setXPostDraft((data.savedFeaturedXPostUrls ?? data.featuredXPostUrls ?? []).join("\n"));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Could not save X post URLs.");
    } finally {
      setSavingXPosts(false);
    }
  }

  async function saveVideoReviews() {
    setSavingVideoReviews(true);
    setError("");
    try {
      const urls = videoReviewDraft
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const data = await updateReviewSettings({ featuredVideoReviewUrls: urls });
      setSettings(data);
      setVideoReviewDraft((data.savedFeaturedVideoReviewUrls ?? data.featuredVideoReviewUrls ?? []).join("\n"));
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "Could not save video review URLs.");
    } finally {
      setSavingVideoReviews(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74d8ba]">Public voice</p>
          <h2 className="text-2xl font-semibold tracking-tight text-white/90">Reviews</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/45">Choose which reviews appear on the landing page. Text reviews are published immediately. Video reviews stay hidden until you approve them.</p>
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

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold text-white/80">Featured X posts</p>
        <p className="mt-1 text-xs leading-5 text-white/40">
          Paste one public X post URL per line. These appear under <strong className="text-white/60">Shared on X</strong> on the landing page and reviews page. Leave empty to use the built-in default post.
        </p>
        <textarea
          value={xPostDraft}
          onChange={(event) => setXPostDraft(event.target.value)}
          rows={4}
          placeholder={"https://x.com/username/status/1234567890"}
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:border-[#5faef0]/40 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            Live now: {(settings.featuredXPostUrls || []).length} post{(settings.featuredXPostUrls || []).length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            disabled={savingXPosts}
            onClick={() => void saveXPosts()}
            className="rounded-lg border border-[#5faef0]/30 bg-[#5faef0]/10 px-4 py-2 text-xs font-semibold text-[#9ed2ff] hover:bg-[#5faef0]/15 disabled:opacity-50"
          >
            {savingXPosts ? "Saving…" : "Save X posts"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm font-semibold text-white/80">Featured video reviews (YouTube)</p>
        <p className="mt-1 text-xs leading-5 text-white/40">
          Paste one public YouTube or YouTube Shorts URL per line. These appear under <strong className="text-white/60">Video reviews</strong> on the landing page and reviews page. Leave empty to use the built-in default video.
        </p>
        <textarea
          value={videoReviewDraft}
          onChange={(event) => setVideoReviewDraft(event.target.value)}
          rows={4}
          placeholder={"https://www.youtube.com/shorts/6gmOVyWTX7k"}
          className="mt-4 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/80 placeholder:text-white/25 focus:border-[#5faef0]/40 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-white/35">
            Live now: {(settings.featuredVideoReviewUrls || []).length} video{(settings.featuredVideoReviewUrls || []).length === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            disabled={savingVideoReviews}
            onClick={() => void saveVideoReviews()}
            className="rounded-lg border border-[#ff6b6b]/30 bg-[#ff6b6b]/10 px-4 py-2 text-xs font-semibold text-[#ffb4b4] hover:bg-[#ff6b6b]/15 disabled:opacity-50"
          >
            {savingVideoReviews ? "Saving…" : "Save video reviews"}
          </button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">{error}</div>}
      {loading ? <div className="space-y-3">{[1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/8 bg-white/[0.02]" />)}</div> : items.length ? <div className="space-y-4">{items.map((item) => <ReviewAdminCard key={item.id} item={item} onChange={() => void load()} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 px-6 py-14 text-center text-sm text-white/45">No reviews yet.</div>}
    </section>
  );
}