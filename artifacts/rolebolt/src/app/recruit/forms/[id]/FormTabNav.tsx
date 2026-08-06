"use client";

import type { FormPageTab } from "@/lib/formTypes";

const TABS: { id: FormPageTab; label: string; hint: string }[] = [
  { id: "responses", label: "Responses", hint: "Applicants & pipeline" },
  { id: "insights", label: "Insights", hint: "Analytics & summary" },
  { id: "autopilot", label: "Auto-hiring", hint: "AI agent & rules" },
];

export default function FormTabNav({
  active,
  onChange,
  responseCount,
}: {
  active: FormPageTab;
  onChange: (tab: FormPageTab) => void;
  responseCount: number;
}) {
  return (
    <nav className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 rounded-xl px-3 py-2.5 text-left transition ${
            active === tab.id
              ? "bg-violet-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span className="block text-xs font-bold">{tab.label}</span>
          <span className={`block text-[10px] mt-0.5 ${active === tab.id ? "text-violet-200" : "text-slate-400"}`}>
            {tab.id === "responses" && responseCount > 0 ? `${responseCount} applicant${responseCount !== 1 ? "s" : ""}` : tab.hint}
          </span>
        </button>
      ))}
    </nav>
  );
}
