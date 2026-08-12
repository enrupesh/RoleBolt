"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { sitegenRoutes } from "../../lib/routes";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";
import { fetchSitegenDraft, loginSitegen, toSessionWebsite } from "../../lib/client";
import { readSitegenSession, saveSitegenSession, clearSitegenSession } from "../../lib/session";
import { SitegenAuthError } from "../../lib/authErrors";
import type { SitegenWebsiteDraft } from "../../types/profile";
import { SitegenFieldLabel, SitegenInput } from "../build/SitegenFormFields";
import { SitegenShareTools } from "../share/SitegenShareTools";

export function SitegenLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const session = readSitegenSession();
    if (session) {
      window.location.href = sitegenRoutes.manage;
    }
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginSitegen({ username, password });
      if (!result.accessToken || !result.website) throw new Error("Sign in failed.");
      saveSitegenSession(result.accessToken, toSessionWebsite(result.website));
      window.location.href = sitegenRoutes.manage;
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <SitegenHeader />
      <main className="mx-auto max-w-lg px-5 py-14 lg:px-8 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Manage your website</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em]">Sign in to Sitegen</h1>
        <p className="mt-4 text-sm leading-7 text-violet-100/60">
          Use your Sitegen username and password to edit, preview, and publish your website.
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <div>
            <SitegenFieldLabel required>Username</SitegenFieldLabel>
            <SitegenInput value={username} onChange={setUsername} placeholder="yourname" />
          </div>
          <div>
            <SitegenFieldLabel required>Password</SitegenFieldLabel>
            <SitegenInput value={password} onChange={setPassword} type="password" />
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button type="submit" disabled={busy} className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-violet-200/45">
          Don&apos;t have a website yet?{" "}
          <Link href={sitegenRoutes.landing} className="font-semibold text-violet-200 hover:text-white">Start from the homepage</Link>
        </p>
      </main>
      <SitegenFooter />
    </div>
  );
}

export function SitegenManagePage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<SitegenWebsiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");

  async function loadWebsite(token: string) {
    setLoading(true);
    setLoadFailed(false);
    setError("");
    try {
      const website = await fetchSitegenDraft(token);
      setDraft(website);
      saveSitegenSession(token, toSessionWebsite(website));
    } catch (loadError: unknown) {
      if (loadError instanceof SitegenAuthError) {
        setAccessToken(null);
        setDraft(null);
        setError(loadError.message);
      } else {
        setLoadFailed(true);
        setError("We couldn't load your website. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const session = readSitegenSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setAccessToken(session.accessToken);
    void loadWebsite(session.accessToken);
  }, []);

  function handleSignOut() {
    clearSitegenSession();
    setAccessToken(null);
    setDraft(null);
    setLoadFailed(false);
    setError("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0618] text-white">
        <SitegenHeader />
        <main className="mx-auto max-w-3xl px-5 py-20 text-center text-sm text-violet-100/60">Loading…</main>
        <SitegenFooter />
      </div>
    );
  }

  if (!accessToken) {
    return <SitegenLoginPage />;
  }

  if (loadFailed || !draft) {
    return (
      <div className="min-h-screen bg-[#0c0618] text-white">
        <SitegenHeader />
        <main className="mx-auto max-w-lg px-5 py-20 text-center">
          <h1 className="font-display text-3xl font-semibold">We couldn&apos;t load your website</h1>
          <p className="mt-4 text-sm text-violet-100/60">{error || "Please try again."}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button type="button" onClick={() => void loadWebsite(accessToken)} className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033]">Try again</button>
            <button type="button" onClick={handleSignOut} className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white">Sign out</button>
          </div>
        </main>
        <SitegenFooter />
      </div>
    );
  }

  const isPublished = draft.status === "published";
  const hasPendingUpdates = Boolean(draft.hasUnpublishedChanges);

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <SitegenHeader />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Website management</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em]">Manage your website</h1>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-violet-100/65">
            Signed in as <span className="font-medium text-white">{draft.username}</span>
          </p>
          <button type="button" onClick={handleSignOut} className="text-sm font-semibold text-violet-200 hover:text-white">Sign out</button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${isPublished ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-200"}`}>
              {isPublished ? "Published" : "Draft"}
            </span>
            {isPublished && hasPendingUpdates ? (
              <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200">
                Unpublished changes
              </span>
            ) : null}
          </div>

          <p className="mt-5 text-sm text-violet-100/65">
            Public URL: <span className="font-medium text-white">{sitegenDisplayPublicUrl(draft.username)}</span>
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Link href={sitegenRoutes.build} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5">
              Edit information
            </Link>
            <Link href={sitegenRoutes.preview} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold hover:bg-white/5">
              Preview website
            </Link>
            <Link href={sitegenRoutes.preview} className="rounded-xl bg-white px-4 py-3 text-center text-sm font-semibold text-[#1a1033] hover:bg-violet-50 sm:col-span-2">
              {isPublished ? (hasPendingUpdates ? "Preview & publish update" : "Open preview") : "Continue to preview & publish"}
            </Link>
            {isPublished && !hasPendingUpdates ? (
              <Link href={sitegenRoutes.publishedSite(draft.username)} target="_blank" className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-100 sm:col-span-2">
                View live website
              </Link>
            ) : null}
          </div>
        </div>

        {isPublished ? (
          <div className="mt-8">
            <SitegenShareTools username={draft.username} publicUrl={draft.publicUrl} />
          </div>
        ) : null}
      </main>
      <SitegenFooter />
    </div>
  );
}
