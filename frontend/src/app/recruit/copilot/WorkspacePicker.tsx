"use client";

import { Briefcase, FileText, Sparkles } from "lucide-react";
import type { CopilotWorkspace } from "@/lib/copilotWorkspace";

const T = {
  bg: "var(--rb-bg)",
  card: "var(--rb-card)",
  border: "var(--rb-border)",
  accent: "var(--rb-accent)",
  text: "var(--rb-text)",
  textSecondary: "var(--rb-text-secondary)",
};

export default function WorkspacePicker({
  onSelect,
}: {
  onSelect: (workspace: CopilotWorkspace) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12">
      <div
        className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-6"
        style={{ background: `linear-gradient(135deg, ${T.accent}, var(--rb-accent-dark))`, boxShadow: "0 0 40px var(--rb-accent-soft-border)" }}
      >
        <Sparkles size={24} color="#fff" />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: T.accent }}>Rolebolt AI</p>
      <h1 className="text-[2rem] tracking-[-0.04em] font-semibold mb-2 text-center" style={{ color: T.text }}>
        AI Hiring Copilot
      </h1>
      <p className="text-[0.9rem] max-w-md text-center mb-10 leading-relaxed" style={{ color: T.textSecondary }}>
        Choose your workspace. Standard Job and Form Job use separate data — the Copilot never mixes them.
      </p>

      <div className="grid gap-4 w-full max-w-lg sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onSelect("standard")}
           className="group rounded-3xl border p-6 text-left transition hover:shadow-lg hover:-translate-y-0.5"
           style={{ borderColor: T.border, background: T.card, boxShadow: "0 1px 2px var(--rb-shadow-color)" }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 mb-4">
            <Briefcase size={22} />
          </span>
          <h2 className="text-base font-bold mb-1.5" style={{ color: T.text }}>Standard Job</h2>
          <p className="text-[12px] leading-5" style={{ color: T.textSecondary }}>
            Resume scoring, rubrics, assessments, and full pipeline for professional hiring.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelect("form")}
           className="group rounded-3xl border p-6 text-left transition hover:shadow-lg hover:-translate-y-0.5"
           style={{ borderColor: T.border, background: T.card, boxShadow: "0 1px 2px var(--rb-shadow-color)" }}
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-600 mb-4">
            <FileText size={22} />
          </span>
          <h2 className="text-base font-bold mb-1.5" style={{ color: T.text }}>Form Job</h2>
          <p className="text-[12px] leading-5" style={{ color: T.textSecondary }}>
            Application forms, AI-scored responses, and creator-friendly hiring workflows.
          </p>
        </button>
      </div>
    </div>
  );
}
