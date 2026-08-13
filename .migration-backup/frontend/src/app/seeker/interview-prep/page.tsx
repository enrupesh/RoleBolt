"use client";

import { useEffect, useState } from "react";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { SeekerErrorNotice } from "@/components/SeekerErrorNotice";
import { apiErrorFromPayload, apiUrl } from "@/lib/api";

type Question = { id: string; question: string; category: string; tips: string };
type Evaluation = { score: number; grade: string; strengths: string[]; improvements: string[]; betterAnswer: string; followUpQuestions: string[] };

const CATEGORY_COLORS: Record<string, string> = {
  behavioral:  "bg-blue-100 text-blue-700",
  technical:   "bg-purple-100 text-purple-700",
  situational: "bg-amber-100 text-amber-700",
  culture:     "bg-green-100 text-green-700",
};

const DIFFICULTIES = ["entry", "mid", "senior"] as const;

function InterviewContent() {
  const { sessionToken } = useRecruitAuth();
  const [screen, setScreen]   = useState<"setup"|"interview"|"feedback"|"summary">("setup");
  const [jobDesc, setJobDesc] = useState("");
  const [difficulty, setDifficulty] = useState<"entry"|"mid"|"senior">("mid");
  const [questions, setQuestions]   = useState<Question[]>([]);
  const [currentQ, setCurrentQ]     = useState(0);
  const [answer, setAnswer]         = useState("");
  const [evaluations, setEvals]     = useState<(Evaluation | null)[]>([]);
  const [currentEval, setCurrentEval] = useState<Evaluation | null>(null);
  const [showBetter, setShowBetter] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<unknown>("");

  useEffect(() => {
    const workspaceId = new URLSearchParams(window.location.search).get("workspaceId");
    if (!workspaceId || !sessionToken) return;
    fetch(apiUrl(`/recruit/seeker/workspace/${encodeURIComponent(workspaceId)}`), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.workspace?.jobDescription) setJobDesc(data.workspace.jobDescription);
      })
      .catch(() => undefined);
  }, [sessionToken]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionToken) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(apiUrl("/recruit/seeker/interview-prep/questions"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ jobDescription: jobDesc, difficulty }),
      });
      const data = await res.json();
       if (!res.ok) throw apiErrorFromPayload(res.status, data, "Failed to load questions.");
      setQuestions(data.questions ?? []);
      setEvals(Array(data.questions?.length ?? 0).fill(null));
      setCurrentQ(0); setAnswer(""); setCurrentEval(null); setShowBetter(false);
      setScreen("interview");
    } catch (e: unknown) { setError(e); }
    finally { setLoading(false); }
  }

  async function handleSubmitAnswer() {
    if (!sessionToken || !answer.trim()) return;
    setLoading(true); setCurrentEval(null);
    try {
      const res = await fetch(apiUrl("/recruit/seeker/interview-prep/evaluate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ question: questions[currentQ].question, answer, jobContext: jobDesc }),
      });
      const data = await res.json();
       if (!res.ok) throw apiErrorFromPayload(res.status, data, "Evaluation failed.");
      setCurrentEval(data);
      setEvals(prev => prev.map((e, i) => i === currentQ ? data : e));
      setScreen("feedback");
    } catch (e: unknown) { setError(e); }
    finally { setLoading(false); }
  }

  function handleNext() {
    if (currentQ + 1 >= questions.length) {
      setScreen("summary");
    } else {
      setCurrentQ(q => q + 1);
      setAnswer(""); setCurrentEval(null); setShowBetter(false);
      setScreen("interview");
    }
  }

  const avgScore = evaluations.filter(Boolean).length > 0
    ? Math.round(evaluations.filter(Boolean).reduce((s, e) => s + (e?.score ?? 0), 0) / evaluations.filter(Boolean).length)
    : 0;

  const GRADE_COLOR: Record<string, string> = { A: "text-green-600", B: "text-indigo-600", C: "text-amber-600", D: "text-orange-600", F: "text-rose-600" };

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

        {/* Setup */}
        {screen === "setup" && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">AI Interview Prep</h1>
              <p className="mt-1 text-sm text-slate-500">Practice with AI-generated questions and get real-time feedback on your answers.</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <form onSubmit={handleStart} className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Job description *</label>
                  <textarea rows={7} required value={jobDesc} onChange={e => setJobDesc(e.target.value)}
                    placeholder="Paste the job description you're preparing for…"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Difficulty</label>
                  <div className="grid grid-cols-3 gap-2">
                    {DIFFICULTIES.map(d => (
                      <button key={d} type="button" onClick={() => setDifficulty(d)}
                        className={`rounded-2xl border py-2.5 text-sm font-semibold capitalize transition ${
                          difficulty === d ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}>{d}</button>
                    ))}
                  </div>
                </div>
                <SeekerErrorNotice error={error} />
                <button type="submit" disabled={loading}
                  className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Generating questions…
                    </span>
                  ) : "Start Mock Interview →"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Interview Question */}
        {screen === "interview" && questions.length > 0 && (
          <div>
            {/* Progress */}
            <div className="mb-5 flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500">Question {currentQ + 1} of {questions.length}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${((currentQ) / questions.length) * 100}%` }} />
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${CATEGORY_COLORS[questions[currentQ].category] ?? "bg-slate-100 text-slate-600"}`}>
                  {questions[currentQ].category}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">{questions[currentQ].question}</h2>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3">
                <p className="text-xs text-indigo-700"><span className="font-bold">💡 Tip: </span>{questions[currentQ].tips}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">Your answer</label>
                <textarea rows={6} value={answer} onChange={e => setAnswer(e.target.value)}
                  placeholder="Type your answer here…"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 transition resize-none" />
              </div>
              <SeekerErrorNotice error={error} />
              <button onClick={handleSubmitAnswer} disabled={loading || !answer.trim()}
                className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Getting AI feedback…
                  </span>
                ) : "Submit Answer →"}
              </button>
            </div>
          </div>
        )}

        {/* Feedback */}
        {screen === "feedback" && currentEval && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Feedback — Question {currentQ + 1}</h2>
              <button onClick={handleNext}
                className="rounded-2xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition">
                {currentQ + 1 >= questions.length ? "See Summary →" : "Next Question →"}
              </button>
            </div>
            <div className="space-y-4">
              {/* Score */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 flex items-center gap-6">
                <div className="text-center">
                  <p className={`text-5xl font-black ${GRADE_COLOR[currentEval.grade?.[0]] ?? "text-slate-700"}`}>{currentEval.grade}</p>
                  <p className="text-xs text-slate-400 mt-1">{currentEval.score}/100</p>
                </div>
                <div className="flex-1">
                  <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${currentEval.score}%` }} />
                  </div>
                </div>
              </div>

              {/* Strengths */}
              {currentEval.strengths.length > 0 && (
                <div className="rounded-3xl border border-green-200 bg-green-50 p-5">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-wide mb-2">✅ Strengths</p>
                  <ul className="space-y-1.5">
                    {currentEval.strengths.map((s, i) => <li key={i} className="text-sm text-green-900 flex gap-2"><span className="shrink-0">•</span>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Improvements */}
              {currentEval.improvements.length > 0 && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">📈 Improvements</p>
                  <ul className="space-y-1.5">
                    {currentEval.improvements.map((s, i) => <li key={i} className="text-sm text-amber-900 flex gap-2"><span className="shrink-0">•</span>{s}</li>)}
                  </ul>
                </div>
              )}

              {/* Better Answer */}
              {currentEval.betterAnswer && (
                <div className="rounded-3xl border border-slate-200 bg-white p-5">
                  <button onClick={() => setShowBetter(v => !v)} className="flex w-full items-center justify-between text-sm font-bold text-slate-900">
                    <span>💬 Sample Better Answer</span>
                    <span className={`transition-transform ${showBetter ? "rotate-180" : ""}`}>▼</span>
                  </button>
                  {showBetter && <p className="mt-3 text-sm text-slate-700 leading-relaxed">{currentEval.betterAnswer}</p>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {screen === "summary" && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Interview Complete! 🎉</h1>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm text-center mb-6">
              <p className="text-6xl font-black text-indigo-600">{avgScore}<span className="text-2xl text-slate-400">/100</span></p>
              <p className="mt-2 text-sm text-slate-500">Overall score across {evaluations.filter(Boolean).length} answered questions</p>
            </div>
            <div className="space-y-3 mb-6">
              {questions.map((q, i) => {
                const ev = evaluations[i];
                return (
                  <div key={q.id} className="rounded-2xl border border-slate-200 bg-white px-5 py-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize mb-1 ${CATEGORY_COLORS[q.category] ?? "bg-slate-100 text-slate-600"}`}>{q.category}</span>
                      <p className="text-sm text-slate-700 truncate">{q.question}</p>
                    </div>
                    <div className="shrink-0 ml-4 text-right">
                      {ev ? (
                        <>
                          <p className={`text-xl font-black ${GRADE_COLOR[ev.grade?.[0]] ?? "text-slate-700"}`}>{ev.grade}</p>
                          <p className="text-[11px] text-slate-400">{ev.score}/100</p>
                        </>
                      ) : <p className="text-xs text-slate-400">Skipped</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setScreen("setup"); setJobDesc(""); setQuestions([]); setEvals([]); setCurrentQ(0); }}
                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
                Practice Again
              </button>
              <button onClick={() => window.print()}
                className="flex-1 rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 transition">
                Download Report
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function InterviewPrepPage() {
  return <RecruitGuard requiredRole="seeker"><InterviewContent /></RecruitGuard>;
}
