"use client";

import { useEffect, useState, type ReactNode } from "react";

function WarningIcon() {
  return (
    <svg className="mt-0.5 shrink-0" width="14" height="14" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions: ReactNode;
};

function Modal({ title, children, onClose, actions }: ModalProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="private-job-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
        <h3 id="private-job-modal-title" className="text-lg font-bold text-slate-900">
          {title}
        </h3>
        <div className="mt-3">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </div>
    </div>
  );
}

export function PrivateJobVisibilitySection({
  isPublic,
  onSetPublic,
  onSetPrivate,
}: {
  isPublic: boolean;
  onSetPublic: () => void;
  onSetPrivate: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [explainOpen, setExplainOpen] = useState(false);

  function openConfirm() {
    setConfirmOpen(true);
  }

  function closeConfirm() {
    setConfirmOpen(false);
  }

  function proceedToExplain() {
    setConfirmOpen(false);
    setExplainOpen(true);
  }

  function confirmPrivate() {
    setExplainOpen(false);
    onSetPrivate();
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Job Visibility</p>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {isPublic ? "Public job" : "Private job"}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {isPublic
                ? "Your job will appear in Find Jobs and can be shared with candidates."
                : "This job will not appear in Find Jobs. Only you can access and manage it from your dashboard."}
            </p>
          </div>
          {!isPublic && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-slate-800 text-white">
              <LockIcon />
            </div>
          )}
        </div>

        {isPublic ? (
          <button
            type="button"
            onClick={openConfirm}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            <LockIcon />
            Make this job private
          </button>
        ) : (
          <>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <WarningIcon />
              <p className="text-xs font-medium leading-relaxed text-amber-800">
                <span className="font-bold">Warning:</span> Once this job is created as private, it cannot be made public again. To publish it later, you will need to create a new job from scratch.
              </p>
            </div>
            <button
              type="button"
              onClick={onSetPublic}
              className="mt-3 text-xs font-semibold text-indigo-600 transition hover:text-indigo-800"
            >
              Keep as public job instead
            </button>
          </>
        )}
      </div>

      {confirmOpen && (
        <Modal
          title="Do you want to make this job private?"
          onClose={closeConfirm}
          actions={
            <>
              <button
                type="button"
                onClick={closeConfirm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={proceedToExplain}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
              >
                Make Private
              </button>
            </>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Private jobs are hidden from Find Jobs and won&apos;t have a public listing link. You can still manage candidates in your hiring workspace.
          </p>
        </Modal>
      )}

      {explainOpen && (
        <Modal
          title="What is a private job?"
          onClose={() => setExplainOpen(false)}
          actions={
            <button
              type="button"
              onClick={confirmPrivate}
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
            >
              I understand, continue
            </button>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Private jobs are designed for job creators who want to work privately — for example, by bulk importing or exporting candidates&apos; resumes from another platform and managing those candidates here without publicly listing the role.
          </p>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
            <WarningIcon />
            <p className="text-xs font-medium leading-relaxed text-amber-800">
              <span className="font-bold">This cannot be undone.</span> Once a job is made private and created, it cannot be switched back to public. If you want to publish the role later, you will need to create a new job from scratch.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
