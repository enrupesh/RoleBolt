"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiUrl } from "@/lib/api";

type GuideMessage = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "rolebolt_site_guide_messages_v2";

const WELCOME_MESSAGE =
  "Welcome to Rolebolt. I’m your AI assistant, here to help you understand the platform, find the right " +
  "features, and get started as a Job Seeker or Job Creator. Ask me what Rolebolt can do, how to use a " +
  "feature, or where to find something on the website.";

const SUGGESTED_PROMPTS = [
  "What can I do with Rolebolt?",
  "How do I use Rolebolt as a Job Seeker?",
  "How do recruiters use Rolebolt?",
  "Where should I start?",
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
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 120);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

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
        className="group fixed bottom-5 right-5 z-[110] flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-[#0a66c2] text-white shadow-[0_10px_28px_rgba(10,72,132,0.26)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#07559f] hover:shadow-[0_14px_34px_rgba(10,72,132,0.34)] sm:bottom-7 sm:right-7"
      >
        {open ? (
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        ) : (
          <svg width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2.5 1.2-4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>
        )}
        {!hasOpenedOnce && !open && (
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2bb58a]" />
        )}
        <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-[#10263d] px-2.5 py-1.5 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 sm:block">Ask Rolebolt AI</span>
      </button>

      {/* Full-page chat workspace */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061522]/60 p-3 backdrop-blur-md sm:p-6 lg:p-10">
          <div className="flex h-[calc(100dvh-1.5rem)] max-h-[820px] w-full max-w-6xl overflow-hidden rounded-[24px] border border-white/70 bg-white shadow-[0_30px_100px_rgba(6,21,34,0.32)] sm:h-[calc(100dvh-3rem)] lg:rounded-[30px]">
            <aside className="hidden w-[280px] shrink-0 flex-col justify-between border-r border-[#e5edf3] bg-[#f7fbff] p-7 lg:flex">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0a66c2] text-white shadow-[0_7px_16px_rgba(10,102,194,.18)]">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2.5 1.2-4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>
                  </div>
                  <div><p className="text-sm font-bold text-[#10263d]">Rolebolt AI</p><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#7190aa]">Site assistant</p></div>
                </div>
                <div className="mt-12">
                  <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#0a66c2]">Explore Rolebolt</p>
                  <h2 className="mt-3 font-display text-3xl font-semibold leading-[1.05] tracking-[-.045em] text-[#10263d]">Your shortcut to the whole platform.</h2>
                  <p className="mt-4 text-sm leading-6 text-[#647a8d]">Ask how anything works, find the right workspace, or get a quick tour for your role.</p>
                </div>
                <div className="mt-8 space-y-2.5">
                  {["Hiring command center", "Job-search workspace", "AI-powered workflows"].map((item) => (
                    <div key={item} className="flex items-center gap-2.5 text-xs font-medium text-[#526e85]">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e2f1ff] text-[#0a66c2]">✓</span>{item}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[11px] leading-5 text-[#8aa0b2]">Rolebolt connects better hiring decisions with a clearer job search.</p>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col bg-white">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e7eef4] bg-white px-5 py-4 sm:px-7">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf3ff] text-[#0a66c2] lg:hidden">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H8l-4 2.5 1.2-4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>
                  </div>
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-[#10263d]">Rolebolt AI assistant</p><div className="flex items-center gap-1.5 text-[11px] text-[#7b91a3]"><span className="h-1.5 w-1.5 rounded-full bg-[#2bb58a]" />Here to help you explore</div></div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={startNewChat} title="Start a new chat" className="rounded-lg border border-[#dbe7ef] px-3 py-2 text-[11px] font-semibold text-[#526e85] transition hover:border-[#a9c8df] hover:bg-[#f6fbff] hover:text-[#0a66c2]">New chat</button>
                  <button onClick={() => setOpen(false)} aria-label="Close Rolebolt AI" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8da1b1] transition hover:bg-[#f2f6f9] hover:text-[#203d56]"><svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#fbfdff] px-4 py-5 sm:px-8 sm:py-7">
                  <div className="mx-auto max-w-3xl space-y-4">
                    {messages.map((m, i) => (
                      <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 sm:max-w-[76%] ${m.role === "user" ? "rounded-br-md bg-[#0a66c2] text-white shadow-[0_7px_18px_rgba(10,102,194,.13)]" : "rounded-bl-md border border-[#e3edf4] bg-white text-[#38546d] shadow-[0_5px_18px_rgba(32,79,112,.05)]"}`}>
                          {m.role === "assistant" ? (
                            m.content ? <div className="copilot-markdown !text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div> : <span className="inline-flex gap-1 py-1"><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9dbbd3] [animation-delay:-0.3s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9dbbd3] [animation-delay:-0.15s]" /><span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9dbbd3]" /></span>
                          ) : m.content}
                        </div>
                      </div>
                    ))}

                    {messages.length <= 1 && !streaming && (
                      <div className="pt-3">
                        <p className="mb-3 text-[11px] font-bold uppercase tracking-[.14em] text-[#8aa0b2]">Try asking</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {SUGGESTED_PROMPTS.map((p) => (
                            <button key={p} onClick={() => sendMessage(p)} className="group flex items-center justify-between rounded-xl border border-[#dce8f0] bg-white px-4 py-3 text-left text-[13px] font-semibold text-[#526e85] shadow-[0_3px_12px_rgba(32,79,112,.035)] transition hover:-translate-y-0.5 hover:border-[#9fc3df] hover:bg-[#f5faff] hover:text-[#0a66c2]">
                              {p}<span className="ml-2 text-[#9ab2c6] transition group-hover:translate-x-0.5 group-hover:text-[#0a66c2]">→</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#e7eef4] bg-white px-4 py-4 sm:px-7 sm:py-5">
                  <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#d6e4ed] bg-[#f8fbfd] p-2 transition focus-within:border-[#8eb9d8] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(10,102,194,.07)]">
                    <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }} placeholder="Ask Rolebolt AI anything…" rows={1} className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2.5 py-2.5 text-sm text-[#203d56] outline-none placeholder:text-[#9aaebb]" />
                    <button type="submit" disabled={streaming || !input.trim()} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white transition hover:bg-[#07559f] disabled:cursor-not-allowed disabled:opacity-35"><svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>
                  </div>
                  <p className="mx-auto mt-2 max-w-3xl text-[10px] text-[#9aaebb]">Rolebolt AI can explain the product and guide you to the right page.</p>
                </form>
              </div>
              </div>
          </div>
        </div>
      )}
    </>
  );
}
