"use client";

import type { FormStage } from "@/lib/formTypes";

type TopPick = {
  _id: string;
  submittedName?: string;
  aiScore: number;
  stage: FormStage;
  aiSummary?: string;
  scoringFailed?: boolean;
};

export default function FormTopPicks({
  responses,
  onSelect,
}: {
  responses: TopPick[];
  onSelect: (id: string) => void;
}) {
  const picks = responses
    .filter(r => !r.scoringFailed && r.aiScore >= 70 && !["rejected", "withdrawn", "hired"].includes(r.stage))
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 3);

  if (picks.length === 0) return null;

  return (
    <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⭐</span>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Top picks</h2>
          <p className="text-[11px] text-slate-500">Highest-scoring applicants worth a closer look</p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {picks.map(p => (
          <button
            key={p._id}
            type="button"
            onClick={() => onSelect(p._id)}
            className="rounded-xl border border-blue-100 bg-white p-3 text-left hover:border-blue-300 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800 truncate">{p.submittedName || "Applicant"}</p>
              <span className="text-sm font-bold text-blue-600">{p.aiScore}%</span>
            </div>
            {p.aiSummary && (
              <p className="mt-1 text-[10px] text-slate-500 line-clamp-2 leading-4">{p.aiSummary}</p>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
