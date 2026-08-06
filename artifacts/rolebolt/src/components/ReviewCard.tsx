"use client";

export type PublicReview = {
  id: string;
  rating: number;
  title: string;
  message: string;
  displayName: string;
  role: "creator" | "seeker";
  featured?: boolean;
};

export function ReviewCard({ review, featured = false }: { review: PublicReview; featured?: boolean }) {
  return (
    <article className={`rounded-2xl border bg-white p-6 shadow-[0_10px_30px_rgba(32,79,112,.06)] ${featured ? "border-[#b9d9f5]" : "border-[#dce7ef]"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-lg tracking-[.08em] text-[#f2b53d]" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}<span className="text-[#dce5ec]">{"★".repeat(5 - review.rating)}</span></div>
        {featured && <span className="rounded-full bg-[#eaf3ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-[#0a66c2]">Featured by Rolebolt</span>}
      </div>
      {review.title && <h3 className="mt-4 font-display text-lg font-semibold tracking-[-.025em] text-[#203d56]">{review.title}</h3>}
      <p className="mt-3 text-sm leading-7 text-[#5d7285]">“{review.message}”</p>
      <div className="mt-5 flex items-center gap-3 border-t border-[#edf1f5] pt-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8f3ff] text-xs font-bold text-[#0a66c2]">{review.displayName.slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="text-sm font-semibold text-[#203d56]">{review.displayName}</p>
          <p className="text-xs font-medium text-[#0a66c2]">Verified Job {review.role === "seeker" ? "Seeker" : "Creator"}</p>
        </div>
      </div>
    </article>
  );
}