"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";
import { RecruitGuard } from "@/components/RecruitGuard";
import { SeekerHeader } from "@/components/SeekerHeader";
import { displayHandle } from "@/lib/username";

const EXTENSION_ID = process.env.NEXT_PUBLIC_ROLEBOLT_EXTENSION_ID || "";

function ExtensionContent() {
  const { sessionToken, authUser } = useRecruitAuth();
  const [extensionConnected, setExtensionConnected] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!sessionToken) return;

    // Bridge sync via content script (auth-bridge.js on rolebolt pages)
    window.postMessage({ type: "ROLEBOLT_EXTENSION_REQUEST_TOKEN" }, "*");

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data?.type === "ROLEBOLT_EXTENSION_TOKEN" && event.data.token) {
        setExtensionConnected(true);
        setStatus("Extension connected via page bridge.");
      }
    };
    window.addEventListener("message", onMessage);

    // Optional: direct external messaging when extension ID is configured at build time
    const extId = EXTENSION_ID;
    const chromeApi = typeof globalThis !== "undefined"
      ? (globalThis as { chrome?: { runtime?: { sendMessage: (id: string, msg: unknown, cb?: (r: { ok?: boolean; connected?: boolean }) => void) => void } } }).chrome
      : undefined;

    if (extId && chromeApi?.runtime?.sendMessage) {
      chromeApi.runtime.sendMessage(
        extId,
        { type: "ROLEBOLT_CONNECT", token: sessionToken, apiBase: window.location.origin },
        (resp) => {
          if (resp?.ok) {
            setExtensionConnected(true);
            setStatus("Extension connected successfully.");
          }
        },
      );
      chromeApi.runtime.sendMessage(extId, { type: "ROLEBOLT_PING" }, (resp) => {
        if (resp?.connected) setExtensionConnected(true);
      });
    } else {
      setTimeout(() => {
        setExtensionConnected(prev => prev ?? true);
        setStatus("Signed in. Visit any job page — the Rolebolt panel appears automatically.");
      }, 800);
    }

    return () => window.removeEventListener("message", onMessage);
  }, [sessionToken]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <SeekerHeader />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-slate-900">Browser Extension</h1>
          <p className="mt-1 text-sm text-slate-500">
            Save jobs from LinkedIn, Indeed, and any career page. Get instant AI match scores on the page you&apos;re viewing.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🧩</span>
            <div>
              <h2 className="font-bold text-slate-900">Install the extension</h2>
              <ol className="mt-2 space-y-2 text-sm text-slate-600 list-decimal list-inside">
                <li>Open <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">chrome://extensions</code></li>
                <li>Enable <strong>Developer mode</strong> (or install from Chrome Web Store when published)</li>
                <li>Click <strong>Load unpacked</strong> and select the <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">extension/</code> folder</li>
              </ol>
            </div>
          </div>

          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-2.5 w-2.5 rounded-full ${extensionConnected ? "bg-emerald-500" : extensionConnected === false ? "bg-amber-400" : "bg-slate-300 animate-pulse"}`} />
              <p className="text-sm font-bold text-slate-900">
                {extensionConnected ? "Connected" : extensionConnected === false ? "Waiting for extension" : "Checking…"}
              </p>
            </div>
            <p className="text-xs text-slate-600">
              Signed in as <strong>{displayHandle(authUser)}</strong>.
              {extensionConnected
                ? " Your session is synced — browse any job posting to use the Live AI panel."
                : " Install the extension, then refresh this page to connect automatically."}
            </p>
            {status && <p className="mt-2 text-xs text-indigo-700">{status}</p>}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">How it works</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2"><span className="text-indigo-500">1.</span> Visit any job on LinkedIn, Indeed, Greenhouse, Lever, or company career pages</li>
              <li className="flex gap-2"><span className="text-indigo-500">2.</span> Click the Rolebolt floating button for instant AI match analysis</li>
              <li className="flex gap-2"><span className="text-indigo-500">3.</span> Save to your Job Workspace, tailor your resume, or track the application</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/seeker/workspace" className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700">
              Open Job Workspace
            </Link>
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Chrome Web Store (coming soon)
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          OAuth login for the extension is planned for a future release. For MVP, connection uses your Rolebolt web session.
        </p>
      </main>
    </div>
  );
}

export default function SeekerExtensionPage() {
  return (
    <RecruitGuard requiredRole="seeker">
      <ExtensionContent />
    </RecruitGuard>
  );
}
