"use client";

import { useEffect, useMemo, useState } from "react";
import { RecruitGuard } from "@/components/RecruitGuard";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import RecruitHeader from "@/components/RecruitHeader";
import { API_BASE_URL, apiUrl } from "@/lib/api";
import { getFirebaseAuth } from "@/lib/firebaseClient";

type CheckStatus = "pending" | "pass" | "warn" | "fail" | "skipped";

type CheckResult = {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  status: CheckStatus;
  httpStatus?: number;
  contentType?: string;
  jsonOk?: boolean;
  message: string;
  snippet?: string;
  durationMs?: number;
};

type AuthState = {
  loading: boolean;
  signedIn: boolean;
  email?: string | null;
  token?: string;
  error?: string;
};

const STATUS_STYLE: Record<CheckStatus, string> = {
  pending: "border-slate-200 bg-white text-slate-500",
  pass: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warn: "border-amber-200 bg-amber-50 text-amber-700",
  fail: "border-rose-200 bg-rose-50 text-rose-700",
  skipped: "border-slate-200 bg-slate-50 text-slate-500",
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: "Running",
  pass: "Pass",
  warn: "Warning",
  fail: "Fail",
  skipped: "Skipped",
};

function baseCheck(id: string, title: string, description: string, endpoint: string): CheckResult {
  return { id, title, description, endpoint, status: "pending", message: "Waiting to run…" };
}

async function runJsonCheck(
  check: CheckResult,
  input: string,
  init: RequestInit,
  validate: (response: Response, data: any) => { status: CheckStatus; message: string }
): Promise<CheckResult> {
  const started = performance.now();
  try {
    const response = await fetch(input, { ...init, cache: "no-store" });
    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    let data: any = null;
    let jsonOk = false;

    try {
      data = text ? JSON.parse(text) : {};
      jsonOk = true;
    } catch {
      jsonOk = false;
    }

    if (!jsonOk) {
      return {
        ...check,
        status: "fail",
        httpStatus: response.status,
        contentType: contentType || "missing",
        jsonOk,
        durationMs: Math.round(performance.now() - started),
        message: "This endpoint did not return valid JSON.",
        snippet: text.slice(0, 180),
      };
    }

    const verdict = validate(response, data);
    return {
      ...check,
      status: verdict.status,
      httpStatus: response.status,
      contentType: contentType || "missing",
      jsonOk,
      durationMs: Math.round(performance.now() - started),
      message: verdict.message,
      snippet: JSON.stringify(data).slice(0, 180),
    };
  } catch (err: any) {
    return {
      ...check,
      status: "fail",
      durationMs: Math.round(performance.now() - started),
      message: err?.message || "Request failed before a response was received.",
    };
  }
}

function CheckCard({ check }: { check: CheckResult }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-slate-900">{check.title}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLE[check.status]}`}>
              {STATUS_LABEL[check.status]}
            </span>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">{check.description}</p>
        </div>
        <div className="text-left text-xs text-slate-400 sm:text-right">
          {typeof check.httpStatus === "number" && <p>HTTP {check.httpStatus}</p>}
          {typeof check.durationMs === "number" && <p>{check.durationMs}ms</p>}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="break-all font-mono text-[11px] text-slate-500">{check.endpoint}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Content Type</p>
          <p className="mt-1 break-all text-xs font-semibold text-slate-700">{check.contentType || "Not checked yet"}</p>
        </div>
        <div className="rounded-2xl border border-slate-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">JSON</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">
            {check.jsonOk === undefined ? "Not checked yet" : check.jsonOk ? "Valid JSON" : "Invalid JSON"}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-100 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Result</p>
          <p className="mt-1 text-xs font-semibold text-slate-700">{check.message}</p>
        </div>
      </div>

      {check.snippet && (
        <details className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <summary className="cursor-pointer text-xs font-bold text-slate-600">Response preview</summary>
          <pre className="mt-3 whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-500">{check.snippet}</pre>
        </details>
      )}
    </div>
  );
}

function RecruitDiagnosticsContent() {
  const [auth, setAuth] = useState<AuthState>({ loading: true, signedIn: false });
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string>("");

  const summary = useMemo(() => {
    const fail = checks.filter(check => check.status === "fail").length;
    const warn = checks.filter(check => check.status === "warn").length;
    const pass = checks.filter(check => check.status === "pass").length;
    if (running) return { label: "Running checks", className: "bg-blue-50 text-blue-700 border-blue-200" };
    if (fail > 0) return { label: `${fail} failing`, className: "bg-rose-50 text-rose-700 border-rose-200" };
    if (warn > 0) return { label: `${warn} warning`, className: "bg-amber-50 text-amber-700 border-amber-200" };
    if (pass > 0) return { label: "Backend connection healthy", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    return { label: "Ready to run", className: "bg-slate-50 text-slate-600 border-slate-200" };
  }, [checks, running]);

  useEffect(() => {
    try {
      const firebaseAuth = getFirebaseAuth();
      return onAuthStateChanged(firebaseAuth, async user => {
        if (!user) {
          setAuth({ loading: false, signedIn: false });
          return;
        }
        try {
          const token = await user.getIdToken();
          setAuth({ loading: false, signedIn: true, email: user.email, token });
        } catch (err: any) {
          setAuth({ loading: false, signedIn: true, email: user.email, error: err?.message || "Could not read auth token." });
        }
      });
    } catch (err: any) {
      setAuth({ loading: false, signedIn: false, error: err?.message || "Firebase auth is not configured." });
    }
  }, []);

  async function runChecks() {
    const publicJobs = baseCheck(
      "public-jobs",
      "Public jobs JSON",
      "Checks that the public Recruit job API returns JSON through the same API helper used by job pages.",
      apiUrl("/recruit-public/jobs?limit=1")
    );
    const backendHealth = baseCheck(
      "backend-health",
      "Backend health JSON",
      "Checks the backend health endpoint through the frontend/backend boundary.",
      apiUrl("/health")
    );
    const authGuard = baseCheck(
      "auth-guard",
      "Recruit auth guard",
      "Checks that protected recruiter APIs return a JSON auth error instead of a frontend 404 page when no token is sent.",
      apiUrl("/recruit/jobs")
    );
    const authenticated = baseCheck(
      "authenticated",
      "Signed-in Recruit API",
      "If you are signed in, checks that an authenticated recruiter endpoint accepts your Firebase token and returns JSON.",
      apiUrl("/recruit/pipeline-summary")
    );

    const initial = [publicJobs, backendHealth, authGuard, authenticated];
    setChecks(initial);
    setRunning(true);

    const results: CheckResult[] = [];
    results.push(await runJsonCheck(publicJobs, publicJobs.endpoint, {}, (response, data) => ({
      status: response.ok && Array.isArray(data.jobs) ? "pass" : "fail",
      message: response.ok && Array.isArray(data.jobs) ? "Public jobs API is returning valid JSON." : "Public jobs API JSON shape is not correct.",
    })));
    setChecks([...results, ...initial.slice(results.length)]);

    results.push(await runJsonCheck(backendHealth, backendHealth.endpoint, {}, response => ({
      status: response.ok ? "pass" : "fail",
      message: response.ok ? "Backend health endpoint is reachable." : "Backend health endpoint returned an error.",
    })));
    setChecks([...results, ...initial.slice(results.length)]);

    results.push(await runJsonCheck(authGuard, authGuard.endpoint, {}, response => ({
      status: response.status === 401 || response.status === 403 ? "pass" : response.ok ? "warn" : "fail",
      message:
        response.status === 401 || response.status === 403
          ? "Protected API is returning a JSON auth response as expected."
          : response.ok
            ? "Protected API responded without auth. Review backend auth rules."
            : "Protected API returned JSON, but not the expected auth status.",
    })));
    setChecks([...results, ...initial.slice(results.length)]);

    if (!auth.token) {
      results.push({
        ...authenticated,
        status: "skipped",
        message: auth.error || "Sign in to run the authenticated Recruit API check.",
      });
    } else {
      results.push(await runJsonCheck(
        authenticated,
        authenticated.endpoint,
        { headers: { Authorization: `Bearer ${auth.token}` } },
        response => ({
          status: response.ok ? "pass" : "fail",
          message: response.ok ? "Authenticated Recruit API is reachable." : "Authenticated Recruit API returned an error.",
        })
      ));
    }

    setChecks(results);
    setLastRun(new Date().toLocaleString());
    setRunning(false);
  }

  useEffect(() => {
    if (!auth.loading) runChecks();
  }, [auth.loading, auth.token]);

  return (
    <div className="min-h-screen bg-slate-50">
      <RecruitHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-5 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-3 py-1 text-xs font-bold ${summary.className}`}>{summary.label}</span>
              {lastRun && <span className="text-xs text-slate-400">Last run: {lastRun}</span>}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Recruit API Diagnostics</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
              Use this page after deploys to confirm Recruit buttons are calling the backend correctly and receiving JSON instead of frontend error pages.
            </p>
          </div>
          <button
            onClick={runChecks}
            disabled={running || auth.loading}
            className="rounded-full bg-[#0a66c2] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#004182] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? "Running…" : "Run checks again"}
          </button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Effective API Base</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-700">{API_BASE_URL}</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Auth State</p>
            <p className="mt-2 text-sm font-semibold text-slate-800">
              {auth.loading ? "Checking…" : auth.signedIn ? `Signed in${auth.email ? ` as ${auth.email}` : ""}` : "Not signed in"}
            </p>
            {auth.error && <p className="mt-1 text-xs text-amber-600">{auth.error}</p>}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Production Backend</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-700">https://raina-1.onrender.com</p>
          </div>
        </div>

        <div className="space-y-4">
          {checks.map(check => <CheckCard key={check.id} check={check} />)}
          {checks.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-slate-600">Checks will run automatically once auth state is ready.</p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-sm font-bold text-blue-950">How to use this after Vercel deploy</h2>
          <p className="mt-2 text-sm leading-6 text-blue-800">
            Open <span className="font-mono">/recruit/diagnostics</span> on the live site. If any check says invalid JSON or shows “The page could not be found”, the frontend is still hitting Vercel instead of Render.
          </p>
          <Link href="/recruit" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold text-[#0a66c2] shadow-sm">
            Back to Recruit
          </Link>
        </div>
      </main>
    </div>
  );
}
export default function RecruitDiagnosticsPage() {
  return <RecruitGuard requiredRole="creator"><RecruitDiagnosticsContent /></RecruitGuard>;
}
