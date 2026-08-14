"use client";

import { useState } from "react";

export default function ShareJobButton({ title, companyName }: { title: string; companyName?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    const text = `${title}${companyName ? ` at ${companyName}` : ""}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: text, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <button
      onClick={share}
      className="flex h-9 min-w-9 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-[#0a66c2] hover:text-[#0a66c2]"
      title="Share job"
    >
      {copied ? "Copied" : "Share"}
    </button>
  );
}