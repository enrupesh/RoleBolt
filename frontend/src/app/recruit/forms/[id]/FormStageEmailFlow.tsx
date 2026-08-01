"use client";

import { useEffect, useMemo, useState } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import {
  FORM_STAGE_EMAIL_NOTIFY_STAGES,
  type FormStageEmailNotifyStage,
  buildFormInterviewEmailBody,
  buildFormStageEmailDefaults,
  DEFAULT_INTERVIEW_FIELDS,
  formEmailTypeForStage,
  formStageEmailPromptText,
  formStageEmailPromptTitle,
  type InterviewEmailFields,
} from "@/lib/formStageEmailTemplates";

export type FormEmailLogEntry = {
  type: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  status: "sent" | "failed";
  error?: string;
};

type FormStageEmailFlowProps = {
  stage: FormStageEmailNotifyStage | null;
  responseId: string;
  candidateName: string;
  candidateEmail?: string;
  formId: string;
  formTitle: string;
  companyName: string;
  token: string;
  onClose: () => void;
  onSent: (entry: FormEmailLogEntry) => void;
};

function FormStageEmailComposer({
  stage,
  responseId,
  candidateName,
  candidateEmail,
  formId,
  formTitle,
  companyName,
  token,
  initialSubject,
  initialBody,
  loadingBody,
  onClose,
  onSent,
}: Omit<FormStageEmailFlowProps, "stage"> & {
  stage: FormStageEmailNotifyStage;
  initialSubject: string;
  initialBody: string;
  loadingBody?: boolean;
}) {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");
  const [interviewFields, setInterviewFields] = useState<InterviewEmailFields>(DEFAULT_INTERVIEW_FIELDS);

  const ctx = useMemo(
    () => ({ candidateName, formTitle, companyName }),
    [candidateName, formTitle, companyName],
  );

  useEffect(() => {
    setSubject(initialSubject);
    setBody(initialBody);
  }, [initialSubject, initialBody]);

  async function send() {
    if (!candidateEmail?.trim()) {
      setSendError("No email address on file for this applicant.");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setSendError("Subject and body are required.");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(apiUrl(`/recruit/forms/${formId}/responses/${responseId}/send-email`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type: formEmailTypeForStage(stage), subject: subject.trim(), body }),
      });
      const data = await readApiJson(res);
      if (data.logEntry) onSent(data.logEntry);
      if (!res.ok) throw new Error(data.error || "Send failed.");
      onSent({
        type: formEmailTypeForStage(stage),
        to: candidateEmail,
        subject: subject.trim(),
        body,
        sentAt: data.sentAt || new Date().toISOString(),
        status: "sent",
      });
      setSent(true);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Send failed.");
    } finally {
      setSending(false);
    }
  }

  const stageLabel = stage.replace(/_/g, " ");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-bold text-slate-900 capitalize">{stageLabel} email</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              To: {candidateName}
              {candidateEmail ? ` · ${candidateEmail}` : " · no email on file"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            <p className="text-base font-semibold text-emerald-700">Email sent to {candidateEmail}</p>
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-violet-600 px-6 py-2 text-sm font-bold text-white hover:bg-violet-700">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {loadingBody ? (
                <p className="text-sm text-slate-500">Generating email…</p>
              ) : (
                <>
                  {stage === "interview" && (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Interview details</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input placeholder="Date" value={interviewFields.interviewDate} onChange={e => {
                          const next = { ...interviewFields, interviewDate: e.target.value };
                          setInterviewFields(next);
                          setBody(buildFormInterviewEmailBody(ctx, next));
                        }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                        <input placeholder="Time" value={interviewFields.interviewTime} onChange={e => {
                          const next = { ...interviewFields, interviewTime: e.target.value };
                          setInterviewFields(next);
                          setBody(buildFormInterviewEmailBody(ctx, next));
                        }} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                        <input placeholder="Meet link" value={interviewFields.meetLink} onChange={e => {
                          const next = { ...interviewFields, meetLink: e.target.value };
                          setInterviewFields(next);
                          setBody(buildFormInterviewEmailBody(ctx, next));
                        }} className="col-span-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Subject</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Message</label>
                    <textarea value={body} onChange={e => setBody(e.target.value)} rows={stage === "interview" ? 12 : 10} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 resize-none font-mono text-[13px]" />
                  </div>
                  <p className="text-[10px] text-slate-400">Your official contact email is added automatically in the footer.</p>
                  {sendError && <p className="text-xs text-rose-500">{sendError}</p>}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={send} disabled={sending || loadingBody || !body.trim()} className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                {sending ? "Sending…" : "Send email"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function FormStageEmailFlow(props: FormStageEmailFlowProps) {
  const { stage, onClose } = props;
  const [showComposer, setShowComposer] = useState(false);
  const [composerSubject, setComposerSubject] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [loadingBody, setLoadingBody] = useState(false);

  const ctx = useMemo(
    () => ({ candidateName: props.candidateName, formTitle: props.formTitle, companyName: props.companyName }),
    [props.candidateName, props.formTitle, props.companyName],
  );

  useEffect(() => {
    if (!stage) {
      setShowComposer(false);
      return;
    }
    setShowComposer(false);
    const defaults = buildFormStageEmailDefaults(stage, ctx);
    setComposerSubject(defaults.subject);
    setComposerBody(defaults.body);
  }, [stage, ctx]);

  async function handleYes() {
    if (!stage) return;
    if (stage === "rejected") {
      setLoadingBody(true);
      setShowComposer(true);
      try {
        const res = await fetch(apiUrl(`/recruit/forms/${props.formId}/responses/${props.responseId}/reject-email`), {
          method: "POST",
          headers: { Authorization: `Bearer ${props.token}` },
        });
        const data = await readApiJson(res);
        if (res.ok && data.email) {
          setComposerBody(data.email);
          setComposerSubject(buildFormStageEmailDefaults("rejected", ctx).subject);
        }
      } catch { /* keep default */ }
      finally { setLoadingBody(false); }
    } else {
      setShowComposer(true);
    }
  }

  if (!stage) return null;

  if (showComposer) {
    return (
      <FormStageEmailComposer
        {...props}
        stage={stage}
        initialSubject={composerSubject}
        initialBody={composerBody}
        loadingBody={loadingBody}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 pt-8 pb-4 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </span>
          <h2 className="text-base font-semibold text-slate-900">{formStageEmailPromptTitle(stage)}</h2>
          <p className="mt-2 text-sm text-slate-500 leading-6">{formStageEmailPromptText(stage)}</p>
          <p className="mt-1 text-xs text-slate-400">{props.candidateName}</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">No, skip</button>
          <button type="button" onClick={handleYes} className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700">Yes, compose email</button>
        </div>
      </div>
    </div>
  );
}

export { FORM_STAGE_EMAIL_NOTIFY_STAGES };
