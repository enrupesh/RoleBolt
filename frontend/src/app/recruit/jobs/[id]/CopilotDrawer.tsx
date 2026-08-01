"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api";

type Msg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
};

const STARTERS = [
  "Who should I interview first?",
  "Summarize candidates stuck in Review Zone",
  "Any scoring failures I should retry?",
];

export default function CopilotDrawer({
  jobId,
  jobTitle,
  token,
  open,
  onClose,
}: {
  jobId: string;
  jobTitle: string;
  token: string;
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const abortRef = useRef<AbortController | null>(null);
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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(apiUrl("/recruit/copilot/chat/stream"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          context: { level: "job", jobId },
          conversationId,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

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
            } catch { /* ignore parse */ }
          }
        }
      }
    } catch (err: unknown) {
      if ((err as { name?: string })?.name !== "AbortError") {
        setMessages(prev =>
          prev.map(m => m.id === aiId ? {
            ...m,
            isStreaming: false,
            content: m.content || "Something went wrong. Please try again.",
          } : m),
        );
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close copilot"
        className="fixed inset-0 z-[70] bg-black/25"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[71] flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Hiring Copilot"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600">Copilot</p>
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">{jobTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--text-muted)]">
                Ask about this job&apos;s pipeline without leaving the page.
              </p>
              {STARTERS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="block w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-left text-xs font-medium text-[var(--text-secondary)] hover:border-violet-400/40 hover:text-[var(--foreground)] transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map(m => (
            <div
              key={m.id}
              className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "ml-8 bg-indigo-500 text-white"
                  : "mr-4 border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]"
              }`}
            >
              {m.content || (m.isStreaming ? "…" : "")}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          className="border-t border-[var(--border)] p-3 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this pipeline…"
            disabled={streaming}
            className="flex-1 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            className="rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </aside>
    </>
  );
}
