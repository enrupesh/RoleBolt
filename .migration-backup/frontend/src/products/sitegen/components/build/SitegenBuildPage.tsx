"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { SitegenSeekerInfoForm } from "./SitegenSeekerInfoForm";
import { SitegenCreatorInfoForm } from "./SitegenCreatorInfoForm";
import { sitegenSiteTypeLabels, sitegenProduct } from "../../config/product";
import { sitegenRoutes } from "../../lib/routes";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";
import { fetchSitegenDraft, loginSitegen, toSessionWebsite } from "../../lib/client";
import { readSitegenSession, saveSitegenSession } from "../../lib/session";
import type { SitegenWebsiteDraft } from "../../types/profile";
import { SitegenFieldLabel, SitegenInput } from "./SitegenFormFields";

export function SitegenBuildPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<SitegenWebsiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  useEffect(() => {
    const session = readSitegenSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setAccessToken(session.accessToken);
    void fetchSitegenDraft(session.accessToken)
      .then((website) => {
        setDraft(website);
        if (website.infoCompletedAt) setCompleted(true);
      })
      .catch(() => setError("We couldn't load your website draft."))
      .finally(() => setLoading(false));
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginBusy(true);
    setError("");
    try {
      const result = await loginSitegen({ username: loginUsername, password: loginPassword });
      if (!result.accessToken || !result.website) throw new Error("Sign in failed.");
      saveSitegenSession(result.accessToken, toSessionWebsite(result.website));
      setAccessToken(result.accessToken);
      setDraft(result.website);
      if (result.website.infoCompletedAt) setCompleted(true);
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    } finally {
      setLoginBusy(false);
    }
  }

  function handleSaved(website: SitegenWebsiteDraft) {
    if (accessToken) saveSitegenSession(accessToken, toSessionWebsite(website));
    setDraft(website);
    setCompleted(true);
  }

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <SitegenHeader />
      <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-violet-100/60">Loading your draft…</div>
        ) : !accessToken || !draft ? (
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-10">
            <h1 className="font-display text-3xl font-semibold tracking-[-0.05em] text-white">Continue your website</h1>
            <p className="mt-3 text-sm leading-7 text-violet-100/60">Sign in with your Sitegen username and password to add your information.</p>
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <div>
                <SitegenFieldLabel required>Username</SitegenFieldLabel>
                <SitegenInput value={loginUsername} onChange={setLoginUsername} placeholder="yourname" />
              </div>
              <div>
                <SitegenFieldLabel required>Password</SitegenFieldLabel>
                <SitegenInput value={loginPassword} onChange={setLoginPassword} type="password" />
              </div>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <button type="submit" disabled={loginBusy} className="inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#1a1033] disabled:opacity-50">
                {loginBusy ? "Signing in…" : "Continue"}
              </button>
            </form>
            <p className="mt-6 text-sm text-violet-200/45">
              Don&apos;t have a draft yet?{" "}
              <Link href={sitegenRoutes.landing} className="font-semibold text-violet-200 hover:text-white">Start from the homepage</Link>
            </p>
          </div>
        ) : completed ? (
          <div className="rounded-[2rem] border border-violet-400/20 bg-white/[0.04] p-8 text-center sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Information saved</p>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">You&apos;re ready for the next step</h1>
            <p className="mt-4 text-sm leading-7 text-violet-100/65">
              Your {sitegenSiteTypeLabels[draft.siteType].toLowerCase()} information has been saved for <strong className="text-white">{sitegenDisplayPublicUrl(draft.username)}</strong>.
              Next: we&apos;ll automatically structure your content with AI on the preview page, then you can choose a pre-built theme.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href={sitegenRoutes.preview} className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] hover:bg-violet-50">
                Continue to preview
              </Link>
              <button type="button" onClick={() => setCompleted(false)} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                Edit information
              </button>
              <Link href={sitegenRoutes.landing} className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                Back to Sitegen
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
              Step 2 · {sitegenSiteTypeLabels[draft.siteType]}
            </p>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Add your information
            </h1>
            <p className="mt-4 text-base leading-7 text-violet-100/60">
              Building for <span className="font-medium text-white">{sitegenDisplayPublicUrl(draft.username)}</span>
            </p>
            <div className="mt-10">
              {draft.siteType === "seeker" ? (
                <SitegenSeekerInfoForm accessToken={accessToken} draft={draft} onSaved={handleSaved} />
              ) : (
                <SitegenCreatorInfoForm accessToken={accessToken} draft={draft} onSaved={handleSaved} />
              )}
            </div>
          </>
        )}
      </main>
      <SitegenFooter />
    </div>
  );
}
