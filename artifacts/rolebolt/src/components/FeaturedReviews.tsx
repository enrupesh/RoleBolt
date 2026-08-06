"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, readApiJson } from "@/lib/api";
import { ReviewCard, type PublicReview } from "./ReviewCard";

export function FeaturedReviews() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    fetch(apiUrl("/recruit-public/reviews/featured"), { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await readApiJson<{ reviews?: PublicReview[]; enabled?: boolean }>(response);
        setReviews(data.reviews || []);
        setEnabled(data.enabled !== false);
      })
      .catch(() => {});
  }, []);

  if (!enabled || !reviews.length) return null;
  return (
    <section className="border-b border-[#dfe8ef] bg-[#f8fbfd]">
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.17em] text-[#0a66c2]">From the community</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-.055em] text-[#10263d]">What people are saying about Rolebolt.</h2>
          </div>
          <Link href="/reviews" className="text-sm font-semibold text-[#0a66c2] hover:text-[#07559f]">Read all reviews →</Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{reviews.map((review) => <ReviewCard key={review.id} review={review} featured />)}</div>
      </div>
    </section>
  );
}