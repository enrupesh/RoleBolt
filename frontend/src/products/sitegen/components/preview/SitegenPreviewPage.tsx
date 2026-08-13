"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { sitegenRoutes } from "../../lib/routes";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";
import { SITEGEN_THEME_OPTIONS } from "../../config/themes";
import {
  fetchSitegenDraft,
  loginSitegen,
  publishSitegenDraft,
  structureSitegenDraft,
  toSessionWebsite,
  updateSitegenTheme,
} from "../../lib/client";
import { readSitegenSession, saveSitegenSession } from "../../lib/session";
import type { SitegenWebsiteDraft } from "../../types/profile";
import type { SitegenThemeId } from "../../types/structuredContent";
import { SitegenThemeRenderer } from "../../themes";
import { SitegenFieldLabel, SitegenInput } from "../build/SitegenFormFields";
import { SitegenShareTools } from "../share/SitegenShareTools";
import { SitegenStructuringProgress } from "./SitegenStructuringProgress";

export function SitegenPreviewPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<SitegenWebsiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [structuring, setStructuring] = useState(false);
  const [structureCompleting, setStructureCompleting] = useState(false);
  const [structureError, setStructureError] = useState("");
  const [previewReady, setPreviewReady] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [error, setError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const autoStructureAttempted = useRef(false);

  const handleStructure = useCallback(async () => {
    if (!accessToken) return;
    setStructuring(true);
    setStructureCompleting(false);
    setStructureError("");
    setPreviewReady(false);
    setError("");
    try {
      const website = await structureSitegenDraft(accessToken);
      setStructureCompleting(true);
      window.setTimeout(() => {
        setDraft(website);
        saveSitegenSession(accessToken, toSessionWebsite(website));
        setStructuring(false);
        setStructureCompleting(false);
        setPreviewReady(true);
      }, 650);
    } catch (structureError: unknown) {
      setStructureError(structureError instanceof Error ? structureError.message : "Structuring failed.");
      setStructuring(false);
      setStructureCompleting(false);
    }
  }, [accessToken]);

  useEffect(() => {
    const session = readSitegenSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setAccessToken(session.accessToken);
    void loadDraft(session.accessToken);
  }, []);

  useEffect(() => {
    if (!accessToken || !draft || structuring || loading) return;
    if (!draft.infoCompletedAt || draft.structuredContent || draft.needsRestructure) return;
    if (autoStructureAttempted.current) return;
    autoStructureAttempted.current = true;
    void handleStructure();
  }, [accessToken, draft, structuring, loading, handleStructure]);

  async function loadDraft(token: string) {
    setLoading(true);
    setError("");
    try {
      const website = await fetchSitegenDraft(token);
      setDraft(website);
      saveSitegenSession(token, toSessionWebsite(website));
    } catch {
      setError("We couldn't load your website draft.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await loginSitegen({ username: loginUsername, password: loginPassword });
      if (!result.accessToken || !result.website) throw new Error("Sign in failed.");
      saveSitegenSession(result.accessToken, toSessionWebsite(result.website));
      setAccessToken(result.accessToken);
      setDraft(result.website);
      autoStructureAttempted.current = false;
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    }
  }

  async function handleThemeChange(themeId: SitegenThemeId) {
    if (!accessToken) return;
    setThemeBusy(true);
    setError("");
    try {
      const website = await updateSitegenTheme(accessToken, themeId);
      setDraft(website);
      saveSitegenSession(accessToken, toSessionWebsite(website));
    } catch (themeError: unknown) {
      setError(themeError instanceof Error ? themeError.message : "Theme update failed.");
    } finally {
      setThemeBusy(false);
    }
  }

  async function handlePublish() {
    if (!accessToken) return;
    setPublishing(true);
    setError("");
    try {
      const website = await publishSitegenDraft(accessToken);
      setDraft(website);
      saveSitegenSession(accessToken, toSessionWebsite(website));
      setJustPublished(true);
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : "Publishing failed.");
    } finally {
      setPublishing(false);
    }
  }

  const themeId = draft?.selectedThemeId || draft?.recommendedThemeId;
  const themes = draft ? SITEGEN_THEME_OPTIONS[draft.siteType] : [];
  const showStructuring = structuring || structureCompleting;
  const canPublish = Boolean(draft?.structuredContent && themeId && draft.infoCompletedAt && !draft.needsRestructure && !showStructuring);
  const isPublished = draft?.status === "published";
  const hasPendingUpdates = Boolean(draft?.hasUnpublishedChanges);
  const hasResume = Boolean(draft?.resumeText?.trim() || draft?.resumeFileName);

  if (!loading && accessToken && draft && justPublished) {
    return (
      <div className="min-h-screen bg-[#0c0618] text-white">
        <SitegenHeader />
        <main className="mx-auto max-w-3xl px-5 py-14 lg:px-8 lg:py-20">
          <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-500/10 p-8 text-center sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
            </div>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">Published</p>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em]">Your website is live!</h1>
            <p className="mt-4 text-sm leading-7 text-emerald-50/80">
              Your website is now publicly available at{" "}
              <strong className="text-white">{sitegenDisplayPublicUrl(draft.username)}</strong>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={sitegenRoutes.publishedSite(draft.username)}
                target="_blank"
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] hover:bg-violet-50"
              >
                View live website
              </Link>
              <Link
                href={sitegenRoutes.manage}
                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                Manage website
              </Link>
            </div>
          </div>

          <div className="mt-8">
            <SitegenShareTools username={draft.username} publicUrl={draft.publicUrl} />
          </div>
        </main>
        <SitegenFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <SitegenHeader />
      <main className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-20">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-sm text-violet-100/60">Loading preview…</div>
        ) : !accessToken || !draft ? (
          <div className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
            <h1 className="font-display text-3xl font-semibold">Preview your website</h1>
            <p className="mt-3 text-sm text-violet-100/60">Sign in to structure and preview your Sitegen website.</p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div><SitegenFieldLabel required>Username</SitegenFieldLabel><SitegenInput value={loginUsername} onChange={setLoginUsername} /></div>
              <div><SitegenFieldLabel required>Password</SitegenFieldLabel><SitegenInput value={loginPassword} onChange={setLoginPassword} type="password" /></div>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
              <button type="submit" className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033]">Continue</button>
            </form>
            <p className="mt-4 text-sm text-violet-200/45">
              <Link href={sitegenRoutes.login} className="text-violet-200 underline">Sign in page</Link>
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Step 3 · Structure & preview</p>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Preview your website</h1>
              <p className="mt-4 text-base leading-7 text-violet-100/60">
                Review your structured content and theme, then publish to <span className="text-white">{sitegenDisplayPublicUrl(draft.username)}</span>.
              </p>
              {isPublished ? (
                <p className="mt-3 text-sm text-violet-200/55">
                  Status: <span className="font-medium text-emerald-200">Published</span>
                  {hasPendingUpdates ? <span className="text-amber-200"> · Unpublished changes</span> : null}
                </p>
              ) : null}
            </div>

            {structureError && !showStructuring ? (
              <SitegenStructuringProgress
                active={false}
                error={structureError}
                onRetry={() => void handleStructure()}
              />
            ) : null}

            {showStructuring ? (
              <SitegenStructuringProgress active={structuring || structureCompleting} completing={structureCompleting} hasResume={hasResume} />
            ) : null}

            {!showStructuring && !draft.structuredContent ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-10">
                <h2 className="text-xl font-semibold">Ready to structure your content</h2>
                <p className="mt-3 text-sm leading-7 text-violet-100/60">
                  We&apos;ll send your saved information to AI, validate the response, and map it to a theme. If AI is unavailable, your saved data is used as a fallback.
                </p>
                {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
                <button type="button" disabled={!draft.infoCompletedAt} onClick={() => void handleStructure()} className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] disabled:opacity-50">
                  Structure my website content
                </button>
                {!draft.infoCompletedAt ? (
                  <p className="mt-4 text-sm text-violet-200/45">
                    Complete your information first on the <Link href={sitegenRoutes.build} className="text-violet-200 underline">build page</Link>.
                  </p>
                ) : null}
              </div>
            ) : null}

            {draft.structuredContent ? (
              <>
                {!showStructuring && draft.aiMessage ? (
                  <div className={`rounded-2xl border px-4 py-3.5 text-sm transition-opacity duration-500 ${previewReady ? "opacity-100" : "opacity-90"} ${draft.aiProcessingStatus === "ai_success" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>
                    {draft.aiMessage}
                  </div>
                ) : null}

                {!showStructuring && draft.needsRestructure ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3.5 text-sm text-amber-100">
                    Your information has changed since the last structuring run. Re-run AI structuring before publishing an update.
                  </div>
                ) : null}

                <div className={`grid gap-6 transition-all duration-500 lg:grid-cols-[280px_1fr] ${showStructuring ? "pointer-events-none opacity-40" : "opacity-100"}`}>
                  <aside className="space-y-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <h2 className="text-sm font-semibold">Themes</h2>
                      <div className="mt-4 space-y-2">
                        {themes.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            disabled={themeBusy}
                            onClick={() => void handleThemeChange(theme.id)}
                            className={`w-full rounded-xl border px-3 py-3 text-left transition ${themeId === theme.id ? "border-violet-400 bg-violet-500/20" : "border-white/10 hover:border-white/20"}`}
                          >
                            <p className="text-sm font-semibold">{theme.name}</p>
                            <p className="mt-1 text-xs text-violet-100/55">{theme.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                    <button type="button" disabled={showStructuring} onClick={() => void handleStructure()} className="w-full rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50">
                      {showStructuring ? "Re-structuring…" : "Re-run AI structuring"}
                    </button>
                    <Link href={sitegenRoutes.build} className="block w-full rounded-full border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-white/5">
                      Edit information
                    </Link>
                  </aside>

                  <div className={`overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)] min-h-[480px] transition-opacity duration-500 ${previewReady ? "opacity-100" : "opacity-100"}`}>
                    {themeId && draft.structuredContent ? (
                      <SitegenThemeRenderer themeId={themeId} content={draft.structuredContent} username={draft.username} />
                    ) : (
                      <div className="flex min-h-[480px] items-center justify-center p-8 text-center text-sm text-slate-500">Select a theme to preview your website.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-violet-400/20 bg-violet-500/10 px-6 py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {isPublished && hasPendingUpdates ? "Ready to publish your update" : "Ready to publish?"}
                      </h2>
                      <p className="mt-1 text-sm text-violet-100/70">
                        {isPublished && !hasPendingUpdates
                          ? "Your live site matches this preview."
                          : `Publishing makes your site live at ${sitegenDisplayPublicUrl(draft.username)}.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {isPublished && !hasPendingUpdates ? (
                        <Link href={sitegenRoutes.publishedSite(draft.username)} target="_blank" className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                          View live site
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled={!canPublish || publishing}
                          onClick={() => void handlePublish()}
                          className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] disabled:opacity-50"
                        >
                          {publishing ? "Publishing…" : isPublished ? "Publish update" : "Publish website"}
                        </button>
                      )}
                      <Link href={sitegenRoutes.manage} className="inline-flex items-center justify-center rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                        Manage
                      </Link>
                    </div>
                  </div>
                  {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
                </div>
              </>
            ) : null}
          </div>
        )}
      </main>
      <SitegenFooter />
    </div>
  );
}
