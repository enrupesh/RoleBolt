"use client";

import { useEffect, useState } from "react";

type Props = {
  text: string;
};

export default function CopyJobButton({ text }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setOpen(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        title="Copy full job details"
        aria-label="Copy job details"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-[#0a66c2] hover:border-[#0a66c2]/30 transition shadow-sm"
      >
        <svg
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="copy-job-title"
        >
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
            onClick={() => setOpen(false)}
          />

          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-[fade-in-up_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="text-emerald-600">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>

            <h3 id="copy-job-title" className="text-center text-base font-bold text-slate-900">
              {copied ? "Copied to clipboard" : "Couldn't copy automatically"}
            </h3>
            <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
              You can paste this into any AI tool (ChatGPT, Gemini, Claude, etc.) to translate it into your language. Thank you!
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href="https://chat.openai.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Open ChatGPT
              </a>
              <a
                href="https://gemini.google.com/"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Open Gemini
              </a>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-full bg-[#0a66c2] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#004182] transition"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
