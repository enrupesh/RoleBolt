"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { apiErrorFromPayload, apiUrl, readApiJson } from "@/lib/api";
import { StandardErrorNotice } from "@/components/StandardErrorNotice";

// ─── Types ────────────────────────────────────────────────────────────────────

type FileStatus = "queued" | "processing" | "done" | "failed";

interface FileEntry {
  file: File;
  status: FileStatus;
  error?: string;
  // populated on done
  candidateId?: string;
  name?: string;
  email?: string;
  scorePct?: number;
  totalScore?: number;
  maxScore?: number;
  aiSummary?: string;
  strengths?: string[];
  redFlags?: string[];
  scoringFailed?: boolean;
}

type Step = "pick" | "importing" | "results";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status, scorePct }: { status: FileStatus; scorePct?: number }) {
  if (status === "queued")
    return <span className="text-[10px] font-medium text-[var(--text-muted)] bg-[var(--surface)] border border-[var(--border)] rounded-full px-2 py-0.5">Queued</span>;
  if (status === "processing")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-2 py-0.5">
        <svg className="animate-spin h-2.5 w-2.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Scoring…
      </span>
    );
  if (status === "failed")
    return <span className="text-[10px] font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">Failed</span>;
  // done
  if (scorePct === undefined) return null;
  const color = scorePct >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
    : scorePct >= 50 ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";
  return <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${color}`}>{scorePct}%</span>;
}

function ScoreBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="h-1 w-full rounded-full bg-[var(--surface)] mt-1.5">
      <div className={`h-1 rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

const ALLOWED_TYPES = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
const ALLOWED_EXT = [".pdf", ".docx", ".txt"];

// ─── Main component ───────────────────────────────────────────────────────────

export default function BulkImportModal({
  jobId,
  token,
  jobTitle,
  onClose,
  onImported,
}: {
  jobId: string;
  token: string;
  jobTitle: string;
  onClose: () => void;
  onImported: (count: number) => void;
}) {
  const [step, setStep] = useState<Step>("pick");
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<unknown>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // Close on Escape (not during import)
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && step !== "importing") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, step]);

  // Auto-scroll results list
  useEffect(() => {
    if (step === "importing") resultsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentIndex, step]);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const valid = arr.filter(f => ALLOWED_TYPES.includes(f.type) || ALLOWED_EXT.some(e => f.name.endsWith(e)));
    const invalid = arr.length - valid.length;
    if (invalid > 0) setError(`${invalid} file${invalid > 1 ? "s" : ""} skipped — only PDF, DOCX, or TXT allowed.`);
    else setError("");

    setEntries(prev => {
      const existing = new Set(prev.map(e => e.file.name + e.file.size));
      const added = valid.filter(f => !existing.has(f.name + f.size)).map(f => ({ file: f, status: "queued" as FileStatus }));
      const next = [...prev, ...added].slice(0, 50);
      return next;
    });
  }, []);

  function removeFile(idx: number) {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  }

  async function startImport() {
    if (entries.length === 0) return;
    setStep("importing");

    const formData = new FormData();
    entries.forEach(e => formData.append("resumes", e.file));

    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/bulk`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const j = await readApiJson(res).catch(() => ({} as any));
        setError(apiErrorFromPayload(res.status, j, j.message || j.error || "Upload failed."));
        setStep("pick");
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === "start") {
              // already set entries
            } else if (ev.type === "file") {
              const idx: number = ev.index;
              setCurrentIndex(idx);
              setEntries(prev => {
                const next = [...prev];
                if (ev.status === "processing") {
                  next[idx] = { ...next[idx], status: "processing" };
                } else if (ev.status === "done") {
                  next[idx] = {
                    ...next[idx],
                    status: "done",
                    candidateId: ev.candidateId,
                    name: ev.name,
                    email: ev.email,
                    scorePct: ev.scorePct,
                    totalScore: ev.totalScore,
                    maxScore: ev.maxScore,
                    aiSummary: ev.aiSummary,
                    strengths: ev.strengths,
                    redFlags: ev.redFlags,
                    scoringFailed: ev.scoringFailed,
                  };
                } else if (ev.status === "failed") {
                  next[idx] = { ...next[idx], status: "failed", error: ev.error };
                }
                return next;
              });
            } else if (ev.type === "complete") {
              setStep("results");
              if (ev.succeeded > 0) onImported(ev.succeeded);
            } else if (ev.type === "error") {
              if (ev.planLimit || ev.code === "PLAN_LIMIT_REACHED") {
                setError(apiErrorFromPayload(409, {
                  error: "PLAN_LIMIT_REACHED",
                  code: ev.code || "PLAN_LIMIT_REACHED",
                  message: ev.error,
                  upgradeRequired: true,
                  category: "creator_standard",
                }, ev.error || "Plan limit reached."));
              } else {
                setError(ev.error || "Import failed.");
              }
              if (ev.planLimit) {
                // Keep results view if some files already succeeded.
              } else {
                setStep("pick");
              }
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setError(e.message || "Import failed.");
      setStep("pick");
    }
  }

  const done = entries.filter(e => e.status === "done");
  const failed = entries.filter(e => e.status === "failed");
  const sorted = [...done].sort((a, b) => (b.scorePct ?? 0) - (a.scorePct ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="relative flex flex-col w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl max-h-[90vh]">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">Bulk Resume Import</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{jobTitle}</p>
          </div>
          {step !== "importing" && (
            <button onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] transition">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* ── Step: Pick files ── */}
        {step === "pick" && (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 leading-5">
              Bulk import scores resumes and applies <strong>Pipeline Rules</strong> only. The AI Agent does not run on bulk uploads — add candidates individually if you need automatic shortlist/reject triage.
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed transition px-6 py-10 flex flex-col items-center justify-center text-center ${
                dragOver ? "border-indigo-500 bg-indigo-500/10" : "border-[var(--border)] hover:border-indigo-500/50 hover:bg-[var(--surface-muted)]"
              }`}
            >
              <svg className="mb-3 text-indigo-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <p className="text-sm font-semibold text-[var(--foreground)]">Drop resumes here or click to browse</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">PDF, DOCX, or TXT · up to 50 files · 5 MB each</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="hidden"
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
            />

            {error ? <StandardErrorNotice error={error} /> : null}

            {/* File list */}
            {entries.length > 0 && (
              <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] max-h-56 overflow-y-auto">
                {entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <svg className="text-[var(--text-muted)] shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="flex-1 min-w-0 text-xs text-[var(--foreground)] truncate">{e.file.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] shrink-0">{(e.file.size / 1024).toFixed(0)} KB</span>
                    <button onClick={() => removeFile(i)} className="text-[var(--text-muted)] hover:text-red-400 transition shrink-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-[var(--text-muted)]">
                {entries.length === 0 ? "No files selected" : `${entries.length} file${entries.length !== 1 ? "s" : ""} selected`}
              </span>
              <button
                disabled={entries.length === 0}
                onClick={startImport}
                className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Import {entries.length > 0 ? `${entries.length} Resume${entries.length !== 1 ? "s" : ""}` : "Resumes"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Importing ── */}
        {(step === "importing" || step === "results") && (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto flex-1">

            {/* Overall progress bar */}
            {step === "importing" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    Scoring resumes with AI…
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    {done.length + failed.length} / {entries.length}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--surface-muted)]">
                  <div
                    className="h-2 rounded-full bg-indigo-500 transition-all duration-500"
                    style={{ width: `${Math.round(((done.length + failed.length) / entries.length) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Per-file progress list (importing step) */}
            {step === "importing" && (
              <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
                {entries.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <svg className="text-[var(--text-muted)] shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="flex-1 min-w-0 text-xs text-[var(--foreground)] truncate">{e.file.name}</span>
                    {e.status === "done" && e.name && (
                      <span className="text-xs text-[var(--text-muted)] truncate max-w-[120px] shrink-0">{e.name}</span>
                    )}
                    <StatusBadge status={e.status} scorePct={e.scorePct} />
                  </div>
                ))}
                <div ref={resultsEndRef} />
              </div>
            )}

            {/* Results table (results step) */}
            {step === "results" && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
                    <svg className="text-emerald-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    <span className="text-xs font-bold text-emerald-400">{done.length} imported</span>
                  </div>
                  {failed.length > 0 && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2">
                      <svg className="text-red-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                      <span className="text-xs font-bold text-red-400">{failed.length} failed</span>
                    </div>
                  )}
                  <span className="ml-auto text-xs text-[var(--text-muted)]">Ranked by score</span>
                </div>

                <div className="rounded-xl border border-[var(--border)] divide-y divide-[var(--border)] overflow-y-auto max-h-[380px]">
                  {sorted.map((e, rank) => (
                    <div key={e.candidateId} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Rank badge */}
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          rank === 0 ? "bg-amber-500/20 text-amber-400" :
                          rank === 1 ? "bg-zinc-400/20 text-zinc-300" :
                          rank === 2 ? "bg-orange-600/20 text-orange-400" :
                          "bg-[var(--surface-muted)] text-[var(--text-muted)]"
                        }`}>
                          {rank + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{e.name || "Unknown"}</p>
                            <StatusBadge status="done" scorePct={e.scorePct} />
                          </div>
                          <p className="text-xs text-[var(--text-muted)] truncate">{e.email || "—"}</p>
                          {e.scorePct !== undefined && <ScoreBar pct={e.scorePct} />}
                          {e.aiSummary && (
                            <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 line-clamp-2">{e.aiSummary}</p>
                          )}
                          {e.strengths && e.strengths.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {e.strengths.slice(0, 3).map((s, si) => (
                                <span key={si} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full px-2 py-0.5">{s}</span>
                              ))}
                            </div>
                          )}
                          {e.redFlags && e.redFlags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {e.redFlags.slice(0, 2).map((f, fi) => (
                                <span key={fi} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">⚠ {f}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {failed.length > 0 && failed.map((e, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 opacity-60">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
                        <svg className="text-red-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--foreground)]">{e.file.name}</p>
                        <p className="text-[10px] text-red-400">{e.error || "Failed to process"}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 shrink-0">
                  <button
                    onClick={() => { setEntries([]); setStep("pick"); setError(""); }}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] transition"
                  >
                    Import more
                  </button>
                  <button
                    onClick={onClose}
                    className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400"
                  >
                    View in Pipeline
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
