"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { ReviewCard, type PublicReview } from "./ReviewCard";
import { SharedOnXPosts } from "./SharedOnXPosts";

export function FeaturedReviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [xPostUrls, setXPostUrls] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/recruit-public/reviews/featured"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await readApiJson<{
          reviews?: PublicReview[];
          enabled?: boolean;
          featuredXPostUrls?: string[];
        }>(response);
        setReviews(data.reviews || []);
        setXPostUrls(data.featuredXPostUrls || []);
        setEnabled(data.enabled !== false);
      })
      .catch(() => {});
  }, []);

  const hasReviews = enabled && reviews.length > 0;
  const hasXPosts = xPostUrls.length > 0;
  if (!hasReviews && !hasXPosts) return null;

  return (
    <section className="border-b border-[#dfe8ef] bg-[#f8fbfd]">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">From the community</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">
              What people are saying about Rolebolt.
            </h2>
          </div>
          {(hasReviews || hasXPosts) ? (
            <Link href="/reviews" className="text-sm font-semibold text-[#0a66c2] hover:text-[#07559f]">
              Read all reviews →
            </Link>
          ) : null}
        </div>

        <div className="mt-10 space-y-12">
          {hasXPosts ? <SharedOnXPosts urls={xPostUrls} /> : null}

          {hasReviews ? (
            <div>
              {hasXPosts ? (
                <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">On Rolebolt</p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {(enabled ? reviews : []).map((review) => (
                  <ReviewCard key={review.id} review={review} featured />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
