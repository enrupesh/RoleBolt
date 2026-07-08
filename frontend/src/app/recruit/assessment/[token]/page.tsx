"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { apiUrl, readApiJson } from "@/lib/api";

type Question = { id: string; text: string };

type AssessmentData = {
  completed: boolean;
  candidateName: string;
  jobTitle?: string;
  jobDepartment?: string;
  jobLocation?: string;
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

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl(`/recruit-public/assessment/${token}`));
        const json = await readApiJson(res);
        if (!res.ok) throw new Error(json.error || "Assessment not found.");
        setData(json);
      } catch (e: any) {
        setError(e.message || "Failed to load assessment.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

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
    setCurrentQ(c => Math.min(c + 1, questions.length - 1));
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
      const res = await fetch(apiUrl(`/recruit-public/assessment/${token}/submit`), {
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
      <div className="min-h-screen bg-[#050508] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size={8} />
          <p className="text-gray-400 text-sm">Loading your assessment...</p>
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
            <p className="text-sm font-bold text-indigo-400 mt-1">Plyndrox Recruit AI</p>
          </div>
        </div>
      </div>
    );
  }

  const questions = data.questions ?? [];
  const totalQ = questions.length;

  if (totalQ === 0) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-6">
        <p className="text-gray-500 text-sm">No questions found. Please contact your recruiter.</p>
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
                  <p className="text-[11px] font-bold text-white tracking-wide leading-none">Plyndrox Recruit AI</p>
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

            <div className="rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-gray-50 p-5 sm:p-6 mb-5">
              <div className="flex items-start gap-3 mb-4">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-[11px] font-bold text-indigo-400 mt-0.5">
                  {currentQ + 1}
                </span>
                <p className="text-sm sm:text-base font-medium text-white leading-7">
                  {currentQuestion?.text}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-gray-50 px-1 py-1 mb-1">
                <p className="px-3 pt-2 text-[10px] text-zinc-700 flex items-center gap-1 mb-1">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Answer in your own words — be specific, reference real situations
                </p>
                <textarea
                  ref={textareaRef}
                  value={currentAnswer}
                  onChange={e => currentQuestion && handleAnswerChange(currentQuestion.id, e.target.value)}
                  rows={8}
                  placeholder="Write your answer here. Be specific — describe the actual situation, what you did, and what the outcome was..."
                  className="w-full rounded-xl border-0 bg-transparent px-3 py-2 text-sm text-white placeholder-zinc-700 outline-none resize-none leading-7"
                />
                <div className="px-3 pb-2 flex items-center justify-between">
                  <span className={`text-[10px] ${wordCount < 30 && currentAnswer.length > 0 ? "text-amber-600" : "text-zinc-700"}`}>
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
            <p className="text-[10px] text-zinc-800">Plyndrox Recruit AI</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
