"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.warn("[pwa] Service worker registration failed:", error);
    });

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#cbddea] bg-white p-3 shadow-[0_14px_35px_rgba(32,79,112,.18)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f0ff]">
        <img src="/rolebolt-icon-192.png" alt="" className="h-7 w-7 rounded-lg" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#10263d]">Install Rolebolt</p>
        <p className="truncate text-xs text-[#718496]">Keep your hiring workspace one tap away.</p>
      </div>
      <button type="button" onClick={() => void installApp()} className="shrink-0 rounded-lg bg-[#0a66c2] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#07559f]">
        Install
      </button>
      <button type="button" onClick={() => setDismissed(true)} aria-label="Dismiss install prompt" className="shrink-0 p-1 text-lg leading-none text-[#8aa0b1] hover:text-[#31536e]">
        ×
      </button>
    </div>
  );
}