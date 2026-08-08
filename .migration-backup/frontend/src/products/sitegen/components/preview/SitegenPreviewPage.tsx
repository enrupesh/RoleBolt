"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { sitegenRoutes } from "../../lib/routes";
import { SITEGEN_THEME_OPTIONS } from "../../config/themes";
import {
  fetchSitegenDraft,
  loginSitegen,
  structureSitegenDraft,
  toSessionWebsite,
  updateSitegenTheme,
} from "../../lib/client";
import { readSitegenSession, saveSitegenSession } from "../../lib/session";
import type { SitegenWebsiteDraft } from "../../types/profile";
import type { SitegenThemeId } from "../../types/structuredContent";
import { SitegenThemeRenderer } from "../../themes";
import { SitegenFieldLabel, SitegenInput } from "../build/SitegenFormFields";

export function SitegenPreviewPage() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [draft, setDraft] = useState<SitegenWebsiteDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [structuring, setStructuring] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    const session = readSitegenSession();
    if (!session) {
      setLoading(false);
      return;
    }
    setAccessToken(session.accessToken);
    void loadDraft(session.accessToken);
  }, []);

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
    } catch (loginError: unknown) {
      setError(loginError instanceof Error ? loginError.message : "Sign in failed.");
    }
  }

  async function handleStructure() {
    if (!accessToken) return;
    setStructuring(true);
    setError("");
    try {
      const website = await structureSitegenDraft(accessToken);
      setDraft(website);
      saveSitegenSession(accessToken, toSessionWebsite(website));
    } catch (structureError: unknown) {
      setError(structureError instanceof Error ? structureError.message : "Structuring failed.");
    } finally {
      setStructuring(false);
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

  const themeId = draft?.selectedThemeId || draft?.recommendedThemeId;
  const themes = draft ? SITEGEN_THEME_OPTIONS[draft.siteType] : [];

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
          </div>
        ) : (
          <div className="space-y-8">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Step 3 · Structure & preview</p>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Preview your website</h1>
              <p className="mt-4 text-base leading-7 text-violet-100/60">
                NVIDIA AI organizes your information into structured website content. Our pre-built themes render the final design — AI never writes the theme code.
              </p>
            </div>

            {!draft.structuredContent ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 sm:p-10">
                <h2 className="text-xl font-semibold">Ready to structure your content</h2>
                <p className="mt-3 text-sm leading-7 text-violet-100/60">
                  We&apos;ll send your saved information to NVIDIA AI, validate the response, and map it to a theme. If AI is unavailable, your saved data is used as a fallback.
                </p>
                {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
                <button type="button" disabled={structuring || !draft.infoCompletedAt} onClick={() => void handleStructure()} className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] disabled:opacity-50">
                  {structuring ? "Structuring with NVIDIA AI…" : "Structure my website content"}
                </button>
                {!draft.infoCompletedAt ? (
                  <p className="mt-4 text-sm text-violet-200/45">
                    Complete your information first on the <Link href={sitegenRoutes.build} className="text-violet-200 underline">build page</Link>.
                  </p>
                ) : null}
              </div>
            ) : (
              <>
                {draft.aiMessage ? (
                  <div className={`rounded-2xl border px-4 py-3.5 text-sm ${draft.aiProcessingStatus === "ai_success" ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100" : "border-amber-400/20 bg-amber-500/10 text-amber-100"}`}>
                    {draft.aiMessage}
                  </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
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
                      {draft.recommendedThemeId ? (
                        <p className="mt-4 text-xs text-violet-200/45">Recommended: {draft.recommendedThemeId}</p>
                      ) : null}
                    </div>
                    <button type="button" disabled={structuring} onClick={() => void handleStructure()} className="w-full rounded-full border border-white/15 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/5 disabled:opacity-50">
                      {structuring ? "Re-structuring…" : "Re-run AI structuring"}
                    </button>
                  </aside>

                  <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white shadow-[0_30px_100px_rgba(0,0,0,.35)]">
                    {themeId && draft.structuredContent ? (
                      <SitegenThemeRenderer themeId={themeId} content={draft.structuredContent} username={draft.username} />
                    ) : null}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-violet-400/20 bg-violet-500/10 px-6 py-5 text-sm text-violet-100/80">
                  Phase 4 complete: your content is structured and mapped to a theme. Publishing to <strong className="text-white">rolebolt.tech/{draft.username}</strong> comes in Phase 5.
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <SitegenFooter />
    </div>
  );
}
