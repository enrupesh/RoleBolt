"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { ReviewCard, type PublicReview } from "@/components/ReviewCard";
import { ReviewModal } from "@/components/ReviewModal";
import { SharedOnXPosts } from "@/components/SharedOnXPosts";
import { apiUrl, readApiJson } from "@/lib/api";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [xPostUrls, setXPostUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);

  function load() {
    setLoading(true);
    fetch(apiUrl("/recruit-public/reviews"), { cache: "no-store" })
      .then(async (response) => {
        const data = await readApiJson<{ reviews?: PublicReview[]; featuredXPostUrls?: string[] }>(response);
        setReviews(data.reviews || []);
        setXPostUrls(data.featuredXPostUrls || []);
      })
      .catch(() => {
        setReviews([]);
        setXPostUrls([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="min-h-screen bg-[#f8fbfd] text-[#10263d]">
      <header className="border-b border-[#dfe8ef] bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/recruit" className="font-display text-lg font-semibold tracking-[-.04em]">Rolebolt</Link>
          <button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg bg-[#0a66c2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#07559f]">Write a review</button>
        </div>
      </header>
      <main>
        <section className="border-b border-[#dfe8ef] bg-white">
          <div className="mx-auto max-w-5xl px-5 py-20 lg:px-8 lg:py-28">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#0a66c2]">Rolebolt reviews</p>
            <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[1.06] tracking-[-.06em] sm:text-6xl">Real experiences from the Rolebolt community.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#647a8d]">See what Job Seekers and Job Creators think about their experience, then share your own.</p>
            <Link href="/reviews/video-rules" className="mt-4 inline-flex text-sm font-semibold text-[#0a66c2] hover:underline">
              Video Review Rules &amp; Rewards →
            </Link>
          </div>
        </section>

        {xPostUrls.length > 0 ? (
          <section className="border-b border-[#dfe8ef] bg-[#f8fbfd]">
            <div className="mx-auto max-w-5xl px-5 py-12 lg:px-8">
              <SharedOnXPosts urls={xPostUrls} />
            </div>
          </section>
        ) : null}

        <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-white" />)}
            </div>
          ) : reviews.length ? (
            <div>
              {xPostUrls.length > 0 ? (
                <p className="mb-6 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">On Rolebolt</p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {reviews.map((review) => <ReviewCard key={review.id} review={review} featured={review.featured} />)}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#cbd9e4] bg-white px-6 py-16 text-center">
              <p className="text-[#647a8d]">No reviews yet. Be the first to share your experience.</p>
              <button type="button" onClick={() => setReviewOpen(true)} className="mt-5 rounded-lg bg-[#0a66c2] px-4 py-2.5 text-sm font-semibold text-white">Write the first review</button>
            </div>
          )}
        </section>
      </main>
      <MarketingFooter />
      {reviewOpen && <ReviewModal onClose={() => setReviewOpen(false)} onSaved={load} />}
    </div>
  );
}
