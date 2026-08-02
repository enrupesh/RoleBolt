"use client";

import type { ReactNode } from "react";

export type JobTabId =
  | "pipeline"
  | "autopilot"
  | "jd"
  | "rubric"
  | "post"
  | "assessment-analytics"
  | "live"
  | "collaboration"
  | "ai-hiring"
  | "job-analysis";

export type TabGroupId = "pipeline" | "autopilot" | "setup" | "insights" | "team";

export const TAB_GROUPS: Array<{
  id: TabGroupId;
  label: string;
  description: string;
  tabs: JobTabId[];
  defaultTab: JobTabId;
}> = [
  {
    id: "pipeline",
    label: "Pipeline",
    description: "Candidates & stages",
    tabs: ["pipeline"],
    defaultTab: "pipeline",
  },
  {
    id: "autopilot",
    label: "Autopilot",
    description: "AI triage & rules",
    tabs: ["autopilot"],
    defaultTab: "autopilot",
  },
  {
    id: "setup",
    label: "Setup",
    description: "JD, rubric, boards",
    tabs: ["jd", "rubric", "post"],
    defaultTab: "jd",
  },
  {
    id: "insights",
    label: "Insights",
    description: "Analytics & AI hiring",
    tabs: ["job-analysis", "assessment-analytics", "live", "ai-hiring"],
    defaultTab: "job-analysis",
  },
  {
    id: "team",
    label: "Team",
    description: "Collaboration",
    tabs: ["collaboration"],
    defaultTab: "collaboration",
  },
];

export function groupForTab(tab: JobTabId): TabGroupId {
  for (const g of TAB_GROUPS) {
    if (g.tabs.includes(tab)) return g.id;
  }
  return "pipeline";
}

export function tabLabel(tab: JobTabId): string {
  switch (tab) {
    case "pipeline": return "Pipeline";
    case "autopilot": return "Autopilot";
    case "jd": return "Job Description";
    case "rubric": return "Scoring Rubric";
    case "post": return "Post to Boards";
    case "assessment-analytics": return "Assessment Analytics";
    case "live": return "Live Progress";
    case "collaboration": return "Collaboration";
    case "ai-hiring": return "AI Hiring";
    case "job-analysis": return "Job Analysis";
  }
}

export default function JobTabNav({
  activeTab,
  onSelectTab,
  badges,
}: {
  activeTab: JobTabId;
  onSelectTab: (tab: JobTabId) => void;
  badges?: Partial<Record<JobTabId | TabGroupId, ReactNode>>;
}) {
  const activeGroup = groupForTab(activeTab);
  const group = TAB_GROUPS.find(g => g.id === activeGroup)!;
  const showSubNav = group.tabs.length > 1;

  return (
    <div className="mb-6 rounded-2xl border border-[#e4dfe8] bg-white/80 px-3 pt-2 shadow-[0_4px_16px_rgba(62,44,87,0.04)] sm:px-4">
      {/* Primary groups */}
      <div className="flex gap-1 overflow-x-auto">
        {TAB_GROUPS.map(g => {
          const isActive = g.id === activeGroup;
          return (
            <button
              key={g.id}
              type="button"
              data-tour={g.id === "pipeline" ? "pipeline-tab" : g.id === "autopilot" ? "autopilot-tab" : undefined}
              onClick={() => onSelectTab(isActive && g.tabs.includes(activeTab) ? activeTab : g.defaultTab)}
              className={`relative whitespace-nowrap rounded-t-xl px-4 py-3 text-sm transition flex items-center gap-1.5 ${
                isActive
                  ? "bg-[#f1ecff] text-[#5b45ad] font-extrabold"
                  : "text-[var(--text-muted)] hover:bg-[#faf8fc] hover:text-[var(--text-secondary)]"
              }`}
              title={g.description}
            >
              {g.id === "autopilot" && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/></svg>
              )}
              {g.label}
              {badges?.[g.id]}
            </button>
          );
        })}
      </div>

      {/* Secondary sub-tabs for multi-tab groups */}
      {showSubNav && (
        <div className="flex flex-wrap gap-2 border-t border-[#eee9f0] py-3">
          {group.tabs.map(tab => {
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSelectTab(tab)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition border ${
                  selected
                    ? "border-[#d8c9f4] bg-[#f7f3ff] text-[#624cae]"
                    : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {tab === "live" && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                  {tabLabel(tab)}
                  {badges?.[tab]}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
