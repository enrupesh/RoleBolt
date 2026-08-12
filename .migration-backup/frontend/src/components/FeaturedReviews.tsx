"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { isFoundersTeamsReview } from "@/lib/foundersTeams";
import { ReviewCard, type PublicReview } from "./ReviewCard";
import { SharedOnXPosts } from "./SharedOnXPosts";
import { SharedVideoReviews } from "./SharedVideoReviews";

export function FeaturedReviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [xPostUrls, setXPostUrls] = useState<string[]>([]);
  const [videoReviewUrls, setVideoReviewUrls] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/recruit-public/reviews/featured"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await readApiJson<{
          reviews?: PublicReview[];
          enabled?: boolean;
          featuredXPostUrls?: string[];
          featuredVideoReviewUrls?: string[];
        }>(response);
        setReviews(data.reviews || []);
        setXPostUrls(data.featuredXPostUrls || []);
        setVideoReviewUrls(data.featuredVideoReviewUrls || []);
        setEnabled(data.enabled !== false);
      })
      .catch(() => {});
  }, []);

  const communityReviews = reviews.filter((review) => !isFoundersTeamsReview(review));
  const hasReviews = enabled && communityReviews.length > 0;
  const hasXPosts = xPostUrls.length > 0;
  const hasVideoReviews = videoReviewUrls.length > 0;
  if (!hasReviews && !hasXPosts && !hasVideoReviews) return null;

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
          {(hasReviews || hasXPosts || hasVideoReviews) ? (
            <Link href="/reviews" className="text-sm font-semibold text-[#0a66c2] hover:text-[#07559f]">
              Read all reviews →
            </Link>
          ) : null}
        </div>

        <div className="mt-10 space-y-12">
          {hasXPosts ? <SharedOnXPosts urls={xPostUrls} /> : null}
          {hasVideoReviews ? <SharedVideoReviews urls={videoReviewUrls} /> : null}

          {hasReviews ? (
            <div>
              {(hasXPosts || hasVideoReviews) ? (
                <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Community reviews</p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {communityReviews.map((review) => (
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
