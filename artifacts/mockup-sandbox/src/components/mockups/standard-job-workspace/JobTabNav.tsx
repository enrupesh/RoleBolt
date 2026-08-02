import type { ReactNode } from "react";

export type JobTabId = "pipeline" | "autopilot" | "jd" | "rubric" | "post" | "assessment-analytics" | "live" | "collaboration" | "ai-hiring" | "job-analysis";

export default function JobTabNav({
  activeTab,
  onSelectTab,
  badges,
}: {
  activeTab: JobTabId;
  onSelectTab: (tab: JobTabId) => void;
  badges?: Partial<Record<JobTabId, ReactNode>>;
}) {
  const tabs: JobTabId[] = ["pipeline", "autopilot", "jd", "rubric", "post", "assessment-analytics", "live", "collaboration", "ai-hiring", "job-analysis"];
  return (
    <div className="mb-6">
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onSelectTab(tab)}
            className={`relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm transition ${
              activeTab === tab ? "border-indigo-500 font-medium text-[var(--foreground)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {tab.replace("-", " ")}
            {badges?.[tab]}
          </button>
        ))}
      </div>
    </div>
  );
}