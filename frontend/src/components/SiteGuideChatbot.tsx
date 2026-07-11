"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiUrl } from "@/lib/api";

type GuideMessage = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "rolebolt_site_guide_messages";

const WELCOME_MESSAGE =
  'Hi, welcome — great to have you here as a judge for [MeshAPI.ai](https://meshapi.ai)! 👋 I\'m the Rolebolt ' +
  "guide, and I'm here to help you explore everything we built for the hackathon. Ask me anything about " +
  "this site — what it does, how to use it, where to find things — or just chat. [The Judges Testing Kit]" +
  "(/recruit/judges) is the fastest way to try everything hands-on.";

const SUGGESTED_PROMPTS = [
  "What is Rolebolt?",
  "I'm a judge — where do I start?",
  "How does AI scoring work?",
];

function loadMessages(): GuideMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: GuideMessage[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

export function SiteGuideChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasOpenedOnce, setHasOpenedOnce] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Restore any in-progress chat on first mount (survives popup close, not page reload-free navigation loss).
  useEffect(() => {
    const existing = loadMessages();
    if (existing.length > 0) setMessages(existing);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming, open]);

  function openPanel() {
    setOpen(true);
    setHasOpenedOnce(true);
    if (messages.length === 0) {
      const seeded: GuideMessage[] = [{ role: "assistant", content: WELCOME_MESSAGE }];
      setMessages(seeded);
      saveMessages(seeded);
    }
  }

  function startNewChat() {
    const seeded: GuideMessage[] = [{ role: "assistant", content: WELCOME_MESSAGE }];
    setMessages(seeded);
    saveMessages(seeded);
    setInput("");
    textareaRef.current?.focus();
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const nextMessages: GuideMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    saveMessages(nextMessages);
    setInput("");
    setStreaming(true);

    // Placeholder assistant bubble to stream tokens into.
    const withPlaceholder: GuideMessage[] = [...nextMessages, { role: "assistant", content: "" }];
    setMessages(withPlaceholder);

    try {
      const res = await fetch(apiUrl("/recruit-public/site-guide/chat/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: acc };
          return updated;
        });
      }

      const finalMessages: GuideMessage[] = [...nextMessages, { role: "assistant", content: acc }];
      saveMessages(finalMessages);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Sorry, I couldn't reach the AI service just now. Please try again in a moment.",
        };
        saveMessages(updated);
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <>
      {/* Floating launcher button */}
      <button
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-label={open ? "Close site guide chat" : "Open site guide chat"}
        className="fixed bottom-5 right-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-[#0a66c2] text-white shadow-[0_8px_24px_rgba(10,102,194,0.4)] hover:bg-[#004182] hover:scale-105 transition-all duration-200 sm:bottom-6 sm:right-6"
      >
        {open ? (
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )}
        {!hasOpenedOnce && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-4 w-4 rounded-full bg-amber-400 border-2 border-white" />
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed inset-0 z-[59] sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[560px] sm:w-[380px] flex flex-col rounded-none sm:rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,23,42,0.22)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-950 px-4 py-3.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a66c2] shrink-0">
                <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-bold text-white leading-tight truncate">Rolebolt Guide</p>
                <p className="text-[11px] text-slate-400 leading-tight">Ask me anything about this site</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={startNewChat}
                title="Start a new chat"
                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
              >
                New chat
              </button>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#f8fafc]">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-[#0a66c2] text-white rounded-br-md"
                      : "bg-white border border-slate-100 text-slate-700 shadow-sm rounded-bl-md"
                  }`}
                >
                  {m.role === "assistant" ? (
                    m.content ? (
                      <div className="copilot-markdown !text-[13.5px]">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="inline-flex gap-1 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" />
                      </span>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}

            {messages.length <= 1 && !streaming && (
              <div className="flex flex-col gap-1.5 pt-1">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="text-left rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:border-[#0a66c2]/30 hover:bg-blue-50/50 hover:text-[#0a66c2] transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-slate-100 bg-white p-3 shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Ask about the site…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13.5px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-[#0a66c2]/40 focus:bg-white max-h-24"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#004182] transition-colors"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
