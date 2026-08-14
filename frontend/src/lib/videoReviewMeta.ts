export type FeaturedVideoReviewMeta = {
  reviewerName: string;
  rewardLabel: string;
  note: string;
};

/** Caption shown under featured community video embeds (keyed by YouTube video id). */
export const FEATURED_VIDEO_REVIEW_META: Record<string, FeaturedVideoReviewMeta> = {
  "6gmOVyWTX7k": {
    reviewerName: "Krishna",
    rewardLabel: "2× Free Token",
    note: "Your turn next — give a video review and earn free tokens after approval.",
  },
};

export function featuredVideoReviewMetaForUrl(url: string, videoId: string): FeaturedVideoReviewMeta | null {
  if (videoId && FEATURED_VIDEO_REVIEW_META[videoId]) {
    return FEATURED_VIDEO_REVIEW_META[videoId];
  }
  const normalized = url.toLowerCase();
  for (const [id, meta] of Object.entries(FEATURED_VIDEO_REVIEW_META)) {
    if (normalized.includes(id)) return meta;
  }
  return null;
}
