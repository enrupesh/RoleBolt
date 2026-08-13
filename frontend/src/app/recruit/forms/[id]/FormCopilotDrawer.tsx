"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl, readApiJson } from "@/lib/api";
import { ArrowUp, CircleStop, FileText, Sparkles, X } from "lucide-react";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

const STARTERS = [
  "Who are the top applicants?",
  "Which applicants should I shortlist?",
  "Summarize overall applicant quality",
  "Who has red flags?",
];

export default function FormCopilotDrawer({
  formId,
  formTitle,
  token,
  open,
  onClose,
}: {
  formId: string;
  formTitle: string;
  token: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming || !token) return;

    const userId = `u-${Date.now()}`;
    const aiId = `a-${Date.now()}`;
    setMessages(prev => [
      ...prev,
      { id: userId, role: "user", content: trimmed },
      { id: aiId, role: "assistant", content: "", isStreaming: true },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch(apiUrl("/recruit/copilot/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          context: { workspace: "form", level: "form", formId },
          conversationId,
        }),
      });

      if (!res.ok || !res.body) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await readApiJson(res).catch(() => ({} as any));
          throw new Error(
            data.message
              || (data.error === "PLAN_LIMIT_REACHED"
                ? "Form Copilot limit reached for this billing period."
                : data.error)
              || "Stream failed",
          );
        }
        throw new Error("Stream failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const line of part.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.type === "token") {
                setMessages(prev =>
                  prev.map(m => m.id === aiId ? { ...m, content: m.content + evt.token } : m),
                );
              } else if (evt.type === "done") {
                setConversationId(evt.conversationId);
                setMessages(prev =>
                  prev.map(m => m.id === aiId ? { ...m, isStreaming: false } : m),
                );
              } else if (evt.type === "error") {
                setMessages(prev =>
                  prev.map(m => m.id === aiId ? {
                    ...m,
                    isStreaming: false,
                    content: evt.error || "Something went wrong.",
                  } : m),
                );
              }
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err: any) {
      setMessages(prev =>
        prev.map(m => m.id === aiId ? {
          ...m,
          isStreaming: false,
          content: m.content || err?.message || "Something went wrong. Please try again.",
        } : m),
      );
    } finally {
      setStreaming(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close copilot"
        className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[71] flex h-full w-full max-w-lg flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Form Copilot"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-fuchsia-500/20">
              <Sparkles size={16} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-[var(--foreground)]">Form Copilot</p>
                <span className="rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-fuchsia-600">FORM JOB</span>
              </div>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]">
                <FileText size={11} />
                {formTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close copilot"
            className="rounded-xl border border-[var(--border)] p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto bg-[var(--surface-muted)] px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="mx-auto max-w-md pt-4">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-fuchsia-500/10 text-fuchsia-600">
                <Sparkles size={20} />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">Review your applicants</h2>
              <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)]">
                Ask about scores, responses, and who to shortlist.
              </p>
              <div className="mt-5 space-y-2">
                {STARTERS.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left text-sm font-medium text-[var(--text-secondary)] shadow-sm transition hover:-translate-y-0.5 hover:border-fuchsia-400/50 hover:text-[var(--foreground)] hover:shadow-md"
                  >
                    <span>{s}</span>
                    <ArrowUp size={14} className="rotate-45 text-[var(--text-muted)] transition group-hover:text-fuchsia-600" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "items-start gap-2.5"}`}>
              {m.role === "assistant" && (
                <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-sm">
                  <Sparkles size={13} />
                </div>
              )}
              <div
                className={`max-w-[86%] whitespace-pre-wrap text-[13px] leading-6 ${
                  m.role === "user"
                    ? "rounded-[20px] rounded-tr-md bg-violet-600 px-4 py-3 text-white shadow-md shadow-violet-500/10"
                    : "rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--foreground)] shadow-sm"
                }`}
              >
                {m.content || (m.isStreaming ? <span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-500" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-500 [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-fuchsia-500 [animation-delay:300ms]" /></span> : "")}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-4 pt-3 sm:px-5"
          onSubmit={e => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-muted)] p-2 transition focus-within:border-fuchsia-500 focus-within:ring-4 focus-within:ring-fuchsia-500/10">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about this form…"
              rows={1}
              className="min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)]"
            />
            <button
              type="submit"
              aria-label={streaming ? "Generating response" : "Send message"}
              disabled={streaming || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-500/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {streaming ? <CircleStop size={16} /> : <ArrowUp size={18} strokeWidth={2.5} />}
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-[var(--text-muted)]">Enter to send · Shift + Enter for a new line</p>
        </form>
      </aside>
    </>
  );
}
