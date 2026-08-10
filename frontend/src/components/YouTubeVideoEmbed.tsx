import { extractYouTubeVideoId } from "@/lib/youtubeVideo";
import { featuredVideoReviewMetaForUrl } from "@/lib/videoReviewMeta";

export function YouTubeVideoEmbed({ url }: { url: string }) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  const meta = featuredVideoReviewMetaForUrl(url, videoId);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce7ef] bg-white shadow-[0_10px_30px_rgba(32,79,112,.06)]">
      <div className="relative aspect-[9/16] w-full max-w-sm mx-auto bg-black sm:max-w-md">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={meta ? `${meta.reviewerName} video review` : "Rolebolt video review"}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      {meta ? (
        <div className="border-t border-[#e8f0f5] bg-gradient-to-b from-[#f8fbfd] to-white px-5 py-4 text-center">
          <p className="text-base font-semibold tracking-[-.02em] text-[#10263d]">
            {meta.reviewerName}
            <span className="mx-2 text-slate-300" aria-hidden="true">·</span>
            <span className="text-[#0a66c2]">Earned {meta.rewardLabel}</span>
          </p>
          <p className="mt-2 text-sm leading-6 text-[#647a8d]">{meta.note}</p>
          <a
            href="/reviews/video-rules"
            className="mt-3 inline-flex text-xs font-bold uppercase tracking-[.12em] text-[#0a66c2] transition hover:text-[#07559f]"
          >
            How video review rewards work →
          </a>
        </div>
      ) : null}
    </div>
  );
}
