"use client";

import { useEffect, useMemo, useState } from "react";
import type { CandidateStage } from "@/app/recruit/jobs/[id]/jobDetailTypes";
import { apiUrl, readApiJson } from "@/lib/api";
import {
  STAGE_EMAIL_NOTIFY_STAGES,
  type StageEmailNotifyStage,
  buildInterviewEmailBody,
  buildStageEmailDefaults,
  DEFAULT_INTERVIEW_FIELDS,
  emailTypeForStage,
  stageEmailPromptText,
  stageEmailPromptTitle,
  type InterviewEmailFields,
} from "@/lib/stageEmailTemplates";

export type StageEmailLogEntry = {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
};

type StageEmailFlowProps = {
  stage: StageEmailNotifyStage | null;
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  token: string;
  onClose: () => void;
  onSent: (entry: StageEmailLogEntry) => void;
  /** Optional: open full offer letter modal instead of simple offer email */
  onOpenOfferLetter?: () => void;
};

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function PreviewBody({ body, subject }: { body: string; subject: string }) {
  const paragraphs = body.split(/\n{2,}/).filter(Boolean);
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white text-[#0f172a] overflow-hidden shadow-inner">
      <div className="bg-[#0a66c2] px-6 py-5 text-center">
        <span className="inline-block rounded-xl bg-white px-3 py-1.5 text-sm font-black tracking-tight text-[#0a66c2]">Rolebolt</span>
      </div>
      <div className="px-6 py-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Subject</p>
        <p className="text-sm font-semibold text-slate-800 -mt-2">{subject || "(No subject)"}</p>
        <div className="border-t border-slate-100 pt-4 space-y-3">
          {paragraphs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Email body is empty.</p>
          ) : (
            paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-7 text-slate-700 whitespace-pre-wrap">{p}</p>
            ))
          )}
        </div>
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400 leading-5">
            You received this email because you applied for a job through Rolebolt.
          </p>
        </div>
      </div>
    </div>
  );
}

function InterviewFieldsPanel({
  fields,
  onChange,
  ctx,
  onApplyToBody,
}: {
  fields: InterviewEmailFields;
  onChange: (fields: InterviewEmailFields) => void;
  ctx: { candidateName: string; jobTitle: string; companyName: string };
  onApplyToBody: (body: string) => void;
}) {
  function update<K extends keyof InterviewEmailFields>(key: K, value: InterviewEmailFields[K]) {
    const next = { ...fields, [key]: value };
    onChange(next);
    onApplyToBody(buildInterviewEmailBody(ctx, next));
  }

  const inputCls =
    "w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-gray-200 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30";

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] p-4 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">Interview details</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-gray-400">Date</span>
          <input type="date" value={fields.interviewDate} onChange={e => update("interviewDate", e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold text-gray-400">Time</span>
          <input type="time" value={fields.interviewTime} onChange={e => update("interviewTime", e.target.value)} className={inputCls} />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Time zone</span>
          <input
            type="text"
            value={fields.timezone}
            onChange={e => update("timezone", e.target.value)}
            placeholder="e.g. Asia/Kolkata"
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Google Meet / Zoom link</span>
          <input
            type="url"
            value={fields.meetLink}
            onChange={e => update("meetLink", e.target.value)}
            placeholder="https://meet.google.com/..."
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Google Calendar invite link</span>
          <input
            type="url"
            value={fields.calendarLink}
            onChange={e => update("calendarLink", e.target.value)}
            placeholder="https://calendar.google.com/..."
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Office location (if in-person)</span>
          <input
            type="text"
            value={fields.location}
            onChange={e => update("location", e.target.value)}
            placeholder="Building, address, floor..."
            className={inputCls}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Interview instructions</span>
          <textarea
            value={fields.instructions}
            onChange={e => update("instructions", e.target.value)}
            rows={3}
            placeholder="What to prepare, who you'll meet, dress code..."
            className={`${inputCls} resize-none`}
          />
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-[10px] font-semibold text-gray-400">Additional notes</span>
          <textarea
            value={fields.notes}
            onChange={e => update("notes", e.target.value)}
            rows={2}
            placeholder="Any custom message..."
            className={`${inputCls} resize-none`}
          />
        </label>
      </div>
      <p className="text-[10px] text-gray-500 leading-4">
        Changes here update the email body automatically. You can still edit the full message below.
      </p>
    </div>
  );
}

function StageEmailComposer({
  stage,
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  jobTitle,
  companyName,
  token,
  initialSubject,
  initialBody,
  loadingBody,
  onClose,
  onSent,
  onOpenOfferLetter,
}: Omit<StageEmailFlowProps, "stage"> & {
  stage: StageEmailNotifyStage;
  initialSubject: string;
  initialBody: string;
  loadingBody?: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [tab, setTab] = useState<"compose" | "preview">("compose");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [interviewFields, setInterviewFields] = useState<InterviewEmailFields>(DEFAULT_INTERVIEW_FIELDS);
  const [startDate, setStartDate] = useState("");

  const ctx = useMemo(
    () => ({ candidateName, jobTitle, companyName }),
    [candidateName, jobTitle, companyName],
  );

  useEffect(() => {
    setSubject(initialSubject);
    setBody(initialBody);
  }, [initialSubject, initialBody]);

  const stageLabel = stage.replace("_", " ");

  async function send() {
    if (!candidateEmail?.trim()) {
      setSendError("No email address on file for this candidate.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setSendError("Subject and body are required.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${candidateId}/send-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: emailTypeForStage(stage), subject: subject.trim(), body }),
      });
      const data = await readApiJson(res);
      if (!res.ok) throw new Error(data.error || "Send failed.");
      onSent({
        type: emailTypeForStage(stage),
        to: candidateEmail,
        subject: subject.trim(),
        body,
        sentAt: data.sentAt || new Date().toISOString(),
        status: "sent",
      });
      setSent(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Send failed.";
      setSendError(msg);
      if (candidateEmail) {
        onSent({
          type: emailTypeForStage(stage),
          to: candidateEmail,
          subject: subject.trim(),
          body,
          sentAt: new Date().toISOString(),
          status: "failed",
          error: msg,
        });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-white/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
              <MailIcon />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white capitalize">{stageLabel} email</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                To: {candidateName}
                {candidateEmail ? ` · ${candidateEmail}` : (
                  <span className="text-amber-500"> · no email on file</span>
                )}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition">
            <XIcon />
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center flex-1">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            <p className="text-base font-semibold text-emerald-400">Email sent to {candidateEmail}</p>
            <p className="text-xs text-gray-400 max-w-sm">This will appear in the candidate&apos;s email history and hiring timeline.</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-indigo-500 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-400 transition">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex border-b border-white/[0.07] px-6 shrink-0">
              {(["compose", "preview"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition border-b-2 -mb-px ${
                    tab === t
                      ? "border-indigo-400 text-indigo-300"
                      : "border-transparent text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {t === "compose" ? "Compose" : "Preview"}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {loadingBody ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Preparing email template…
                </div>
              ) : tab === "preview" ? (
                <PreviewBody subject={subject} body={body} />
              ) : (
                <>
                  {stage === "offer" && onOpenOfferLetter && (
                    <div className="rounded-2xl border border-sky-500/25 bg-sky-500/[0.08] px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <p className="text-[11px] text-sky-200 leading-5">
                        Need a full AI-generated offer letter with tracking? Use the offer letter builder instead.
                      </p>
                      <button
                        type="button"
                        onClick={() => { onClose(); onOpenOfferLetter(); }}
                        className="shrink-0 rounded-lg border border-sky-400/40 px-3 py-1.5 text-[11px] font-bold text-sky-300 hover:bg-sky-500/15 transition"
                      >
                        Open offer letter
                      </button>
                    </div>
                  )}

                  {stage === "interview" && (
                    <InterviewFieldsPanel
                      fields={interviewFields}
                      onChange={setInterviewFields}
                      ctx={ctx}
                      onApplyToBody={setBody}
                    />
                  )}

                  {stage === "hired" && (
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Start date (optional)</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => {
                          setStartDate(e.target.value);
                          const defaults = buildStageEmailDefaults("hired", ctx, { startDate: e.target.value });
                          setBody(defaults.body);
                        }}
                        className="w-full max-w-xs rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500/50"
                      />
                    </label>
                  )}

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Subject</span>
                    <input
                      type="text"
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-gray-200 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30"
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Message</span>
                    <textarea
                      value={body}
                      onChange={e => setBody(e.target.value)}
                      rows={stage === "interview" ? 14 : 12}
                      className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-gray-200 leading-7 placeholder-zinc-600 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 resize-none font-mono text-[13px]"
                      placeholder="Write your message..."
                    />
                  </label>

                  <p className="text-[10px] text-gray-500 leading-4">
                    Your official recruiter contact email is added automatically in the footer. Edit freely before sending.
                  </p>

                  {sendError && <p className="text-xs text-rose-400">{sendError}</p>}
                </>
              )}
            </div>

            <div className="flex justify-between gap-3 border-t border-white/[0.07] px-6 py-4 shrink-0">
              <button type="button" onClick={onClose} className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-400 hover:text-white transition">
                Cancel
              </button>
              <div className="flex items-center gap-2">
                {tab === "compose" && (
                  <button
                    type="button"
                    onClick={() => setTab("preview")}
                    className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-gray-300 hover:text-white transition"
                  >
                    Preview
                  </button>
                )}
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || loadingBody || !body.trim() || !subject.trim()}
                  className="flex items-center gap-2 rounded-xl bg-indigo-500 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-400 disabled:opacity-50 transition"
                >
                  {sending ? (
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <SendIcon />
                  )}
                  {sending ? "Sending…" : "Send to candidate"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StageEmailPrompt({
  stage,
  candidateName,
  onYes,
  onNo,
}: {
  stage: StageEmailNotifyStage;
  candidateName: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[2rem] border border-white/[0.09] bg-[#0a0a0f] shadow-2xl overflow-hidden">
        <div className="px-6 pt-8 pb-4 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
            <MailIcon />
          </span>
          <h2 className="text-base font-semibold text-white">{stageEmailPromptTitle(stage)}</h2>
          <p className="mt-2 text-sm text-gray-400 leading-6">
            {stageEmailPromptText(stage)}
          </p>
          <p className="mt-1 text-xs text-gray-500">{candidateName}</p>
        </div>
        <div className="flex gap-3 border-t border-white/[0.07] px-6 py-4">
          <button
            type="button"
            onClick={onNo}
            className="flex-1 rounded-xl border border-white/[0.08] py-2.5 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/[0.04] transition"
          >
            No, skip
          </button>
          <button
            type="button"
            onClick={onYes}
            className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-bold text-white hover:bg-indigo-400 transition"
          >
            Yes, compose email
          </button>
        </div>
      </div>
    </div>
  );
}

export function isStageEmailNotifyStage(stage: CandidateStage): stage is StageEmailNotifyStage {
  return (STAGE_EMAIL_NOTIFY_STAGES as readonly string[]).includes(stage);
}

export default function StageEmailFlow({
  stage,
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  jobTitle,
  companyName,
  token,
  onClose,
  onSent,
  onOpenOfferLetter,
}: StageEmailFlowProps) {
  const [showComposer, setShowComposer] = useState(false);
  const [composerBody, setComposerBody] = useState("");
  const [composerSubject, setComposerSubject] = useState("");
  const [loadingBody, setLoadingBody] = useState(false);

  const ctx = useMemo(
    () => ({ candidateName, jobTitle, companyName }),
    [candidateName, jobTitle, companyName],
  );

  useEffect(() => {
    if (!stage) {
      setShowComposer(false);
      return;
    }
    setShowComposer(false);
    const defaults = buildStageEmailDefaults(stage, ctx);
    setComposerSubject(defaults.subject);
    setComposerBody(defaults.body);
  }, [stage, ctx]);

  async function handleYes() {
    if (!stage) return;
    if (stage === "rejected") {
      setLoadingBody(true);
      setShowComposer(true);
      try {
        const res = await fetch(apiUrl(`/recruit/jobs/${jobId}/candidates/${candidateId}/reject-email`), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await readApiJson(res);
        if (res.ok && data.email) {
          setComposerBody(data.email);
          const defaults = buildStageEmailDefaults("rejected", ctx);
          setComposerSubject(defaults.subject);
        }
      } catch {
        /* keep default body */
      } finally {
        setLoadingBody(false);
      }
    } else {
      setShowComposer(true);
    }
  }

  if (!stage) return null;

  if (showComposer) {
    return (
      <StageEmailComposer
        stage={stage}
        candidateId={candidateId}
        candidateName={candidateName}
        candidateEmail={candidateEmail}
        jobId={jobId}
        jobTitle={jobTitle}
        companyName={companyName}
        token={token}
        initialSubject={composerSubject}
        initialBody={composerBody}
        loadingBody={loadingBody}
        onClose={onClose}
        onSent={onSent}
        onOpenOfferLetter={onOpenOfferLetter}
      />
    );
  }

  return (
    <StageEmailPrompt
      stage={stage}
      candidateName={candidateName}
      onYes={handleYes}
      onNo={onClose}
    />
  );
}
