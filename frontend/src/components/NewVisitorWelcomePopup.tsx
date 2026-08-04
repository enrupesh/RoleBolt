"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const DISMISSED_KEY = "rolebolt_new_visitor_welcome_seen";

export function NewVisitorWelcomePopup({ disabled = false }: { disabled?: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (disabled) return;

    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === "1") return;
    } catch {
      // If storage is unavailable, still let the visitor see the welcome once.
    }

    const timer = window.setTimeout(() => setVisible(true), 1200);
    return () => window.clearTimeout(timer);
  }, [disabled]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // The popup is still dismissed for the current render.
    }
  }

  if (!visible || disabled) return null;

  return (
    <aside
      className="fixed inset-x-4 bottom-24 z-[80] mx-auto w-auto max-w-[390px] overflow-hidden rounded-2xl border border-[#cbddea] bg-white shadow-[0_18px_55px_rgba(16,58,91,.2)] sm:inset-x-auto sm:bottom-24 sm:right-6"
      role="dialog"
      aria-labelledby="new-visitor-welcome-title"
    >
      <div className="h-1 bg-gradient-to-r from-[#0a66c2] via-[#53b4f4] to-[#2bb58a]" />
      <div className="relative p-5 sm:p-6">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close welcome popup"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-xl leading-none text-[#8aa0b1] transition hover:bg-[#f1f6fa] hover:text-[#31536e]"
        >
          ×
        </button>

        <div className="flex items-start gap-3.5 pr-7">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f0ff]">
            <svg aria-hidden="true" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" />
              <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#0a66c2]">Welcome to Rolebolt</p>
            <h2 id="new-visitor-welcome-title" className="mt-1.5 text-lg font-semibold tracking-[-.025em] text-[#10263d]">
              Thanks for coming
            </h2>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-[#647a8d]">
          Thanks for coming, explore the preview page to see how Rolebolt brings hiring and job search together.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/recruit/preview"
            onClick={dismiss}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0a66c2] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(10,102,194,.18)] transition hover:bg-[#07559f]"
          >
            Explore preview page
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/recruit/signup"
            onClick={dismiss}
            className="inline-flex items-center justify-center rounded-xl border border-[#cbd9e4] bg-white px-4 py-2.5 text-sm font-semibold text-[#31536e] transition hover:border-[#0a66c2] hover:text-[#0a66c2]"
          >
            Sign up
          </Link>
        </div>
      </div>
    </aside>
  );
}