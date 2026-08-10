"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement | null) => void;
      };
    };
  }
}

let widgetsScriptPromise: Promise<void> | null = null;

function loadTwitterWidgets() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.twttr?.widgets) return Promise.resolve();
  if (widgetsScriptPromise) return widgetsScriptPromise;

  widgetsScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://platform.twitter.com/widgets.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load X embed script.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load X embed script."));
    document.body.appendChild(script);
  });

  return widgetsScriptPromise;
}

export function XPostEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !url) return;

    container.innerHTML = `
      <blockquote class="twitter-tweet" data-dnt="true" data-theme="light">
        <a href="${url.replace(/"/g, "&quot;")}"></a>
      </blockquote>
    `;

    let cancelled = false;
    void loadTwitterWidgets()
      .then(() => {
        if (!cancelled) window.twttr?.widgets.load(container);
      })
      .catch(() => {
        if (!cancelled) {
          container.innerHTML = `
            <a href="${url.replace(/"/g, "&quot;")}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#0a66c2] hover:text-[#0a66c2]">
              View post on X
            </a>
          `;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      className="min-h-[120px] overflow-hidden rounded-2xl border border-[#dce7ef] bg-white p-2 shadow-[0_10px_30px_rgba(32,79,112,.06)] [&_.twitter-tweet]:!mx-0 [&_.twitter-tweet]:!my-0"
    />
  );
}
