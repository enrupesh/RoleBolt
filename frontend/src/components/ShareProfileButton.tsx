"use client";

import { useState } from "react";

export default function ShareProfileButton({ url, label = "Share profile" }: { url: string; label?: string }) {
  const [message, setMessage] = useState("");

  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        setMessage("Shared");
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Link copied");
      }
    } catch {
      setMessage("");
    }
    window.setTimeout(() => setMessage(""), 2200);
  }

  return (
    <button type="button" onClick={share} className="relative rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700" aria-label="Share this profile">
      {message || label}
    </button>
  );
}