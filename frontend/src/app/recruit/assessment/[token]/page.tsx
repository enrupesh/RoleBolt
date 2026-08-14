"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { apiUrl, readApiJson } from "@/lib/api";

// Fire-and-forget: ping the backend with the candidate's current question index
function pingProgress(token: string, questionIndex: number, formMode: boolean) {
  const path = formMode
    ? `/recruit-public/forms/assessment/${token}/progress`
    : `/recruit-public/assessment/${token}/progress`;
  fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ questionIndex }),
  }).catch(() => {/* silently ignore — progress tracking is best-effort */});
}

type Question = { id: string; text: string };

type AssessmentData = {
  completed: boolean;
  needsStart?: boolean;
  candidateName: string;
  jobTitle?: string;
  jobDepartment?: string;
  jobLocation?: string;
  formTitle?: string;
  formDescription?: string;
  jobDetails?: {
    companyName?: string;
    department?: string;
    location?: string;
    workMode?: string;
  };
  questions?: Question[];
};

function Spinner({ size = 4 }: { size?: number }) {
  return (
    <svg className={`animate-spin h-${size} w-${size}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function AssessmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const searchParams = useSearchParams();
  const formMode = searchParams.get("form") === "1";
  const [data, setData] = useState<AssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const questionStartRef = useRef<number>(Date.now());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const path = formMode
          ? `/recruit-public/forms/assessment/${token}`
          : `/recruit-public/assessment/${token}`;
        const res = await fetch(apiUrl(path));
        const json = await readApiJson(res);
        if (!res.ok) throw new Error(json.error || "Assessment not found.");
        setData(formMode
          ? {
              ...json,
              jobTitle: json.formTitle,
              jobDepartment: json.jobDetails?.department,
              jobLocation: json.jobDetails?.location,
            }
          : json);
        if (!json.needsStart && !json.completed) {
          pingProgress(token, 0, formMode);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load assessment.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token, formMode]);

  async function handleStartAssessment() {
    if (formMode) return;
    setStarting(true);
    setStartError("");
    try {
      const res = await fetch(apiUrl(`/recruit-public/assessment/${token}/start`), { method: "POST" });
      const json = await readApiJson(res);
      if (!res.ok) throw new Error(json.error || "Could not start assessment.");
      setData(json);
      pingProgress(token, 0, formMode);
    } catch (e: any) {
      setStartError(e.message || "Could not start assessment.");
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    questionStartRef.current = Date.now();
    textareaRef.current?.focus();
  }, [currentQ]);

  const handleAnswerChange = useCallback((qId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  }, []);

  function recordTimingAndAdvance() {
    const questions = data?.questions ?? [];
    const q = questions[currentQ];
    if (!q) return;
    const elapsed = Math.round((Date.now() - questionStartRef.current) / 1000);
    setTimings(prev => ({ ...prev, [q.id]: elapsed }));
    const nextQ = Math.min(currentQ + 1, questions.length - 1);
    setCurrentQ(nextQ);
    pingProgress(token, nextQ, formMode);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    if (currentQ > 0) {
      setCurrentQ(c => c - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleSubmit() {
    const questions = data?.questions ?? [];
    if (questions.length === 0) return;

    const q = questions[currentQ];
    const elapsed = q ? Math.round((Date.now() - questionStartRef.current) / 1000) : 0;
    const finalTimings = q ? { ...timings, [q.id]: elapsed } : timings;

    const answerPayload = questions.map(question => ({
      questionId: question.id,
      answer: (answers[question.id] ?? "").trim(),
      timeTakenSeconds: finalTimings[question.id] ?? 0,
    }));

    const unanswered = answerPayload.filter(a => a.answer.length === 0);
    if (unanswered.length > 0) {
      setSubmitError(`Please answer all ${questions.length} questions before submitting.`);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const path = formMode
        ? `/recruit-public/forms/assessment/${token}/submit`
        : `/recruit-public/assessment/${token}/submit`;
      const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answerPayload }),
      });
      const json = await readApiJson(res);
      if (!res.ok) throw new Error(json.error || "Submission failed. Please try again.");
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setSubmitError(e.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050508] flex flex-col animate-[rb-fade-in_0.3s_ease_both]"
           style={{ "--sk-from": "#1a1a24", "--sk-mid": "#22222e", "--sk-to": "#1a1a24" } as React.CSSProperties}>
        {/* Progress bar area */}
        <div className="w-full px-4 pt-8 pb-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="h-3 w-24 rounded-full" style={{ background: "#22222e" }} />
            <div className="h-3 w-12 rounded-full" style={{ background: "#22222e" }} />
          </div>
          <div className="h-1.5 w-full rounded-full" style={{ background: "#22222e" }}>
            <div className="h-1.5 w-1/3 rounded-full" style={{ background: "#3d3d55" }} />
          </div>
        </div>
        {/* Question card */}
        <div className="flex-1 flex items-start justify-center px-4 pb-10">
          <div className="w-full max-w-2xl rounded-2xl border p-6 sm:p-8 space-y-5"
               style={{ background: "#0d0d13", borderColor: "#1e1e2a" }}>
            <div className="h-3 w-20 rounded-full" style={{ background: "#22222e" }} />
            <div className="space-y-2">
              <div className="h-5 w-full rounded-lg" style={{ background: "#22222e" }} />
              <div className="h-5 w-4/5 rounded-lg" style={{ background: "#22222e" }} />
            </div>
            <div className="h-36 w-full rounded-xl" style={{ background: "#22222e" }} />
            <div className="flex items-center justify-between pt-2">
              <div className="h-9 w-20 rounded-lg" style={{ background: "#22222e" }} />
              <div className="h-9 w-28 rounded-lg" style={{ background: "#22222e" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-2">Assessment not found</p>
          <p className="text-gray-400 text-sm leading-6">{error}</p>
          <p className="text-zinc-700 text-xs mt-4">If you believe this is an error, please contact your recruiter.</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (data.completed || submitted) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        
        <div className="relative max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            {submitted ? "Submitted!" : "Already Completed"}
          </h1>
          <p className="text-gray-500 text-sm leading-7">
            {submitted
              ? `Thank you, ${data.candidateName.split(" ")[0]}. Your answers have been received and our AI is analyzing them now. The recruiting team will be in touch soon.`
              : `This assessment has already been completed. Thank you for your time, ${data.candidateName.split(" ")[0]}.`}
          </p>
          <div className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-5 py-4">
            <p className="text-[10px] text-zinc-700 uppercase tracking-widest">Powered by</p>
            <p className="text-sm font-bold text-indigo-400 mt-1">Rolebolt</p>
          </div>
        </div>
      </div>
    );
  }

  const questions = data.questions ?? [];
  const totalQ = questions.length;

  if (data.needsStart || totalQ === 0) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">You&apos;ve been screened</h1>
          <p className="text-gray-400 text-sm leading-7 mb-2">
            Hi {data.candidateName.split(" ")[0]}, your application for <strong className="text-gray-200">{data.jobTitle}</strong> passed initial screening.
          </p>
          <p className="text-gray-500 text-sm leading-6 mb-6">
            When you click below, your written assessment will be prepared. After you complete it, the hiring team will review your results and decide whether you proceed to the next round.
          </p>
          {startError && <p className="text-rose-400 text-sm mb-4">{startError}</p>}
          <button
            type="button"
            onClick={handleStartAssessment}
            disabled={starting}
            className="w-full rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-indigo-400 transition disabled:opacity-60"
          >
            {starting ? "Preparing your assessment…" : "Start Assessment →"}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQ];
  const currentAnswer = currentQuestion ? (answers[currentQuestion.id] ?? "") : "";
  const wordCount = currentAnswer.trim().split(/\s+/).filter(Boolean).length;
  const progressPct = Math.round(((currentQ + 0.5) / totalQ) * 100);
  const isLastQuestion = currentQ === totalQ - 1;
  const answeredCount = questions.filter(q => (answers[q.id] ?? "").trim().length > 0).length;
  const allAnswered = answeredCount === totalQ;

  return (
    <div className="min-h-screen bg-[#050508] text-[#1d2226]">
      

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="border-b border-white/[0.06] bg-[#050508]/80 backdrop-blur-xl sticky top-0 z-20 px-4 sm:px-6 py-4">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-5 w-5 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/10">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-white tracking-wide leading-none">Rolebolt</p>
                  {data.jobTitle && <p className="text-[10px] text-gray-400 mt-0.5 leading-none truncate max-w-[160px] sm:max-w-xs">{data.jobTitle}</p>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-gray-500">{currentQ + 1} <span className="text-gray-400">/ {totalQ}</span></p>
                <p className="text-[10px] text-zinc-700">~10 min</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {questions.map((q, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                    i < currentQ
                      ? "bg-indigo-500"
                      : i === currentQ
                      ? "bg-indigo-400/60"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <div
              className="mt-1 h-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 py-6 sm:py-8">
          <div className="mx-auto max-w-2xl">
            {currentQ === 0 && (
              <div className="mb-5 rounded-2xl border border-indigo-500/15 bg-indigo-500/[0.05] px-4 py-4">
                <p className="text-sm font-medium text-indigo-300 mb-1">
                  Hi {data.candidateName.split(" ")[0]} 👋
                </p>
                <p className="text-xs text-gray-400 leading-6">
                  This assessment is for the <span className="text-gray-500 font-medium">{data.jobTitle}</span> role.
                  Answer each question in your own words, drawing from real situations and experience.
                  Be specific — vague answers score lower than honest, detailed ones. This takes about 10 minutes.
                </p>
              </div>
            )}

            <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 mb-5 shadow-sm">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-[11px] font-bold text-indigo-700 mt-0.5">
                  {currentQ + 1}
                </span>
                <p className="text-sm sm:text-base font-medium text-slate-900 leading-7">
                  {currentQuestion?.text}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-1 py-1 mb-1">
                <p className="px-3 pt-2 text-[10px] text-slate-600 flex items-center gap-1 mb-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Answer in your own words — be specific, reference real situations
                </p>
                <textarea
                  ref={textareaRef}
                  value={currentAnswer}
                  onChange={e => currentQuestion && handleAnswerChange(currentQuestion.id, e.target.value)}
                  rows={8}
                  placeholder="Write your answer here. Be specific — describe the actual situation, what you did, and what the outcome was..."
                  className="w-full rounded-xl border-0 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none leading-7 caret-indigo-600"
                />
                <div className="px-3 pb-2 flex items-center justify-between">
                  <span className={`text-[10px] ${wordCount < 30 && currentAnswer.length > 0 ? "text-amber-700" : "text-slate-500"}`}>
                    {wordCount} words
                    {wordCount > 0 && wordCount < 30 ? " — add more detail" : wordCount >= 80 ? " ✓" : ""}
                  </span>
                  {answers[currentQuestion?.id ?? ""] && (
                    <span className="text-[10px] text-emerald-700">Saved</span>
                  )}
                </div>
              </div>
            </div>

            {answeredCount > 0 && answeredCount < totalQ && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                {questions.map((q, i) => {
                  const done = (answers[q.id] ?? "").trim().length > 0;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQ(i)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition ${
                        i === currentQ
                          ? "bg-indigo-500/25 text-indigo-300 border border-indigo-500/30"
                          : done
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : "bg-white text-gray-400 border border-white/[0.06]"
                      }`}
                    >
                      Q{i + 1}{done && i !== currentQ ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
            )}

            {submitError && (
              <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 flex items-start gap-2">
                <svg width="14" height="14" className="text-rose-400 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                <p className="text-sm text-rose-400">{submitError}</p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={goBack}
                disabled={currentQ === 0}
                className="flex items-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 sm:px-5 py-2.5 text-sm text-gray-400 hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                Back
              </button>

              {isLastQuestion ? (
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !currentAnswer.trim()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 sm:px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <><Spinner size={4} /> Submitting...</>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" /></svg>
                      {allAnswered ? "Submit Assessment" : `Submit (${answeredCount}/${totalQ} answered)`}
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={recordTimingAndAdvance}
                  disabled={!currentAnswer.trim()}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-500 px-5 sm:px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              )}
            </div>

            {isLastQuestion && !allAnswered && (
              <p className="text-center text-xs text-gray-400 mt-3">
                You have {totalQ - answeredCount} unanswered question{totalQ - answeredCount !== 1 ? "s" : ""}.
                Use the Q buttons above to navigate back.
              </p>
            )}
          </div>
        </main>

        <footer className="border-t border-white/[0.04] px-4 sm:px-6 py-3">
          <div className="mx-auto max-w-2xl flex items-center justify-between">
            <p className="text-[10px] text-zinc-800">Your responses are securely processed by AI</p>
            <p className="text-[10px] text-zinc-800">Rolebolt</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
