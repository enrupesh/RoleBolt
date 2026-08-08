"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SitegenHeader } from "../layout/SitegenHeader";
import { SitegenFooter } from "../layout/SitegenFooter";
import { SitegenUsernameField } from "./SitegenUsernameField";
import { sitegenProduct, sitegenSiteTypeLabels } from "../../config/product";
import type { SitegenSiteType } from "../../config/product";
import { sitegenRoutes } from "../../lib/routes";
import { createSitegenDraft, toSessionWebsite } from "../../lib/client";
import { saveSitegenSession } from "../../lib/session";
import { validateSitegenPassword } from "../../lib/username";

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export function SitegenCreateDraftPage({ siteType }: { siteType: SitegenSiteType }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usernameValid, setUsernameValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ username: string; publicUrl: string } | null>(null);

  const passwordError = useMemo(() => {
    if (!password) return "";
    return validateSitegenPassword(password) || "";
  }, [password]);

  const confirmError = useMemo(() => {
    if (!confirmPassword) return "";
    if (password !== confirmPassword) return "Passwords do not match.";
    return "";
  }, [password, confirmPassword]);

  const canSubmit = usernameValid && !passwordError && !confirmError && password.length >= 8 && confirmPassword.length >= 8;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!canSubmit) return;

    setBusy(true);
    try {
      const result = await createSitegenDraft({ username, password, siteType });
      if (!result.website || !result.accessToken) {
        throw new Error("We couldn't create your website draft.");
      }
      saveSitegenSession(result.accessToken, toSessionWebsite(result.website));
      setCreated({ username: result.website.username, publicUrl: result.website.publicUrl });
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "We couldn't create your website draft.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0c0618] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-32 top-0 h-[420px] w-[420px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[360px] w-[360px] rounded-full bg-fuchsia-500/15 blur-[100px]" />
      </div>

      <div className="relative">
        <SitegenHeader />

        <main className="mx-auto max-w-2xl px-5 py-14 lg:px-8 lg:py-20">
          {created ? (
            <div className="rounded-[2rem] border border-violet-400/20 bg-white/[0.04] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.35)] sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-violet-300">Draft created</p>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white sm:text-4xl">
                Your URL is reserved
              </h1>
              <p className="mt-4 text-sm leading-7 text-violet-100/65">
                We saved your {sitegenSiteTypeLabels[siteType].toLowerCase()} website draft. Use your username and password anytime to continue building.
              </p>
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/45">Your website URL</p>
                <p className="mt-2 break-all text-lg font-semibold text-white">{created.publicUrl.replace("https://www.", "")}</p>
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href={sitegenRoutes.build}
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#1a1033] transition hover:bg-violet-50"
                >
                  Continue to information
                </Link>
                <Link
                  href={sitegenRoutes.landing}
                  className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Back to Sitegen
                </Link>
              </div>
              <p className="mt-5 text-xs text-violet-200/40">Next: add your resume or business information.</p>
            </div>
          ) : (
            <>
              <Link href={sitegenRoutes.landing} className="inline-flex text-sm font-medium text-violet-200/60 transition hover:text-white">
                ← Back
              </Link>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
                {sitegenSiteTypeLabels[siteType]}
              </p>
              <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
                Claim your username
              </h1>
              <p className="mt-4 text-base leading-7 text-violet-100/60">
                Create your website with a username and password. You&apos;ll use these credentials to sign in and manage your site later.
              </p>

              <form onSubmit={handleSubmit} className="mt-10 space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 sm:p-8">
                <SitegenUsernameField value={username} onChange={setUsername} onValidChange={setUsernameValid} />

                <div>
                  <label htmlFor="sitegen-password" className="text-xs font-semibold uppercase tracking-[.12em] text-violet-200/70">
                    Password
                  </label>
                  <input
                    id="sitegen-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
                    placeholder="At least 8 characters"
                    required
                  />
                  {passwordError ? <p className="mt-2 text-xs text-red-300">{passwordError}</p> : null}
                </div>

                <div>
                  <label htmlFor="sitegen-confirm-password" className="text-xs font-semibold uppercase tracking-[.12em] text-violet-200/70">
                    Confirm password
                  </label>
                  <input
                    id="sitegen-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
                    placeholder="Repeat your password"
                    required
                  />
                  {confirmError ? <p className="mt-2 text-xs text-red-300">{confirmError}</p> : null}
                </div>

                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/10 px-4 py-3.5 text-sm leading-6 text-violet-100/75">
                  Your future website URL:{" "}
                  <span className="font-semibold text-white">
                    {sitegenProduct.hostDomain}/{username || "yourname"}
                  </span>
                </div>

                {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">{error}</p> : null}

                <button
                  type="submit"
                  disabled={!canSubmit || busy}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-semibold text-[#1a1033] transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Creating draft…" : "Create website draft"}
                  <ArrowIcon />
                </button>
              </form>
            </>
          )}
        </main>

        <SitegenFooter />
      </div>
    </div>
  );
}
