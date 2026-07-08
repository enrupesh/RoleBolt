"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type SavedSearch = {
  id: string;
  label: string;
  url: string;
  savedAt: string;
};

const STORAGE_KEY = "recruit_saved_searches";

function loadSaved(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSaved(searches: SavedSearch[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(searches)); } catch {}
}

function buildLabel(params: URLSearchParams): string {
  const parts: string[] = [];
  const q = params.get("q");
  const niche = params.get("niche");
  const workMode = params.get("workMode");
  const freshers = params.get("freshersAllowed");
  const location = params.get("location");
  const seniority = params.get("seniority");
  if (q) parts.push(`"${q}"`);
  if (niche) parts.push(niche.split(",")[0].trim());
  if (workMode) parts.push(workMode.charAt(0).toUpperCase() + workMode.slice(1));
  if (seniority) parts.push(seniority);
  if (location) parts.push(location);
  if (freshers === "true") parts.push("Freshers ok");
  return parts.length > 0 ? parts.join(" · ") : "All jobs";
}

export default function SavedSearches() {
  const searchParams = useSearchParams();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSearches(loadSaved());
  }, []);

  const hasFilters = Array.from(searchParams.entries()).length > 0;
  const currentUrl = `/recruit/opportunities?${searchParams.toString()}`;
  const currentLabel = buildLabel(searchParams);
  const alreadySaved = searches.some(s => s.url === currentUrl);

  function handleSave() {
    if (alreadySaved || !hasFilters) return;
    setSaving(true);
    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      label: currentLabel,
      url: currentUrl,
      savedAt: new Date().toISOString(),
    };
    const updated = [newSearch, ...searches].slice(0, 8);
    setSearches(updated);
    persistSaved(updated);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleDelete(id: string) {
    const updated = searches.filter(s => s.id !== id);
    setSearches(updated);
    persistSaved(updated);
  }

  if (searches.length === 0 && !hasFilters) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-slate-900">Saved searches</span>
          {searches.length > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{searches.length}</span>}
        </div>
        {hasFilters && (
          <button
            onClick={handleSave}
            disabled={alreadySaved || saving}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
              saved ? "border-green-200 bg-green-50 text-green-700" :
              alreadySaved ? "border-slate-200 text-slate-400 cursor-default" :
              "border-[#0a66c2]/30 text-[#0a66c2] hover:bg-blue-50"
            }`}
          >
            {saved ? "✓ Saved" : alreadySaved ? "Already saved" : "＋ Save this search"}
          </button>
        )}
      </div>

      {searches.length === 0 ? (
        <p className="text-xs text-slate-400">No saved searches yet. Apply filters and save them for quick access.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {searches.map(s => (
            <div key={s.id} className="group flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 pr-1 pl-3 py-1 text-xs font-semibold text-slate-700 hover:border-[#0a66c2]/30 transition">
              <Link href={s.url} className="hover:text-[#0a66c2] transition">
                {s.label}
              </Link>
              <button
                onClick={() => handleDelete(s.id)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition ml-0.5"
                aria-label="Remove saved search"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
