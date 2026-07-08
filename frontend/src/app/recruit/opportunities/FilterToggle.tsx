"use client";

import { useState } from "react";

function FilterIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

export default function FilterToggle({ hasFilters }: { hasFilters: boolean }) {
  const [open, setOpen] = useState(false);

  function toggle() {
    setOpen(o => !o);
    const panel = document.getElementById("filter-panel-mobile");
    if (panel) {
      panel.classList.toggle("hidden");
      panel.classList.toggle("block");
    }
  }

  return (
    <button
      onClick={toggle}
      className={`lg:hidden flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition ${
        hasFilters || open
          ? "border-[#0a66c2] bg-blue-50 text-[#0a66c2]"
          : "border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      <FilterIcon />
      Filters
      {hasFilters && <span className="h-1.5 w-1.5 rounded-full bg-[#0a66c2]" />}
    </button>
  );
}
