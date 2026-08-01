"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CHECKLIST_KEY = "recruit_form_post_create_checklist";

export type FormChecklistEntry = {
  formId: string;
  formTitle: string;
  createdAt: string;
  shared?: boolean;
  autopilotEnabled?: boolean;
  reviewedApplicant?: boolean;
  dismissed?: boolean;
};

function loadEntries(): FormChecklistEntry[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: FormChecklistEntry[]) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(entries.slice(0, 8)));
  } catch { /* ignore */ }
}

export function registerFormPostCreateChecklist(formId: string, formTitle: string) {
  try {
    const entries = loadEntries().filter(e => e.formId !== formId && !e.dismissed);
    entries.unshift({ formId, formTitle, createdAt: new Date().toISOString() });
    saveEntries(entries);
  } catch { /* ignore */ }
}

export function markFormChecklistStep(formId: string, step: "shared" | "autopilotEnabled" | "reviewedApplicant") {
  try {
    const entries = loadEntries();
    saveEntries(entries.map(e => (e.formId === formId ? { ...e, [step]: true } : e)));
  } catch { /* ignore */ }
}

export default function FormPostCreateChecklist({
  formId,
  formTitle,
  responseCount,
  agentEnabled,
  onShare,
  onOpenAutopilot,
}: {
  formId: string;
  formTitle: string;
  responseCount: number;
  agentEnabled: boolean;
  onShare: () => void;
  onOpenAutopilot: () => void;
}) {
  const [entry, setEntry] = useState<FormChecklistEntry | null>(null);

  useEffect(() => {
    const found = loadEntries().find(e => e.formId === formId && !e.dismissed);
    if (!found) return;
    const enriched = {
      ...found,
      formTitle,
      autopilotEnabled: found.autopilotEnabled || agentEnabled,
      reviewedApplicant: found.reviewedApplicant || responseCount > 0,
    };
    setEntry(enriched);
    if (JSON.stringify(enriched) !== JSON.stringify(found)) {
      saveEntries(loadEntries().map(e => (e.formId === formId ? enriched : e)));
    }
  }, [formId, formTitle, responseCount, agentEnabled]);

  if (!entry) return null;

  const steps = [
    { id: "shared" as const, label: "Share your form link", done: entry.shared, action: onShare },
    { id: "autopilot" as const, label: "Turn on AI auto-hiring", done: entry.autopilotEnabled, action: onOpenAutopilot },
    { id: "review" as const, label: "Review your first applicant", done: entry.reviewedApplicant, action: undefined },
  ];
  const remaining = steps.filter(s => !s.done).length;
  if (remaining === 0) return null;

  function dismiss() {
    saveEntries(loadEntries().map(e => (e.formId === formId ? { ...e, dismissed: true } : e)));
    setEntry(null);
  }

  function completeStep(step: "shared" | "autopilotEnabled" | "reviewedApplicant") {
    markFormChecklistStep(formId, step);
    setEntry(prev => prev ? { ...prev, [step]: true } : prev);
  }

  return (
    <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Get started with {formTitle}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{remaining} step{remaining !== 1 ? "s" : ""} left to launch hiring</p>
        </div>
        <button type="button" onClick={dismiss} className="text-[10px] text-slate-400 hover:text-slate-600">Dismiss</button>
      </div>
      <ul className="space-y-2">
        {steps.map(step => (
          <li key={step.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${step.done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white"}`}>
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${step.done ? "bg-emerald-500 text-white" : "border border-slate-300 text-slate-400"}`}>
              {step.done ? "✓" : ""}
            </span>
            <span className={`flex-1 text-xs ${step.done ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}>{step.label}</span>
            {!step.done && step.action && (
              <button
                type="button"
                onClick={() => {
                  if (step.id === "shared") {
                    completeStep("shared");
                    step.action?.();
                  } else if (step.id === "autopilot") {
                    step.action?.();
                  }
                }}
                className="rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-violet-700"
              >
                {step.id === "shared" ? "Share" : "Set up"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
