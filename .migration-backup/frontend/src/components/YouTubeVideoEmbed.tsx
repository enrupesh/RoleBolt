import { extractYouTubeVideoId } from "@/lib/youtubeVideo";

export function YouTubeVideoEmbed({ url }: { url: string }) {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#dce7ef] bg-white shadow-[0_10px_30px_rgba(32,79,112,.06)]">
      <div className="relative aspect-[9/16] w-full max-w-sm mx-auto bg-black sm:max-w-md">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title="Rolebolt video review"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
