"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RoleboltLogo } from "@/components/RoleboltLogo";
import { UsernameField } from "@/components/UsernameField";
import { validateUsername } from "@/lib/username";
import { apiUrl } from "@/lib/api";
import { useRecruitAuth } from "@/contexts/RecruitAuthContext";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/recruit/dashboard";
  return raw;
}

function ChooseUsernameContent() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNextPath(params.get("next"));
  const role = params.get("role") === "seeker" ? "seeker" : "creator";
  const { authUser, sessionToken, loading, refreshProfile, signOut } = useRecruitAuth();
  const [username, setUsername] = useState("");
  const [usernameOk, setUsernameOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!authUser || !sessionToken) {
      router.replace("/recruit/login");
      return;
    }
    if (authUser.username?.trim()) {
      router.replace(nextPath);
    }
  }, [authUser, loading, nextPath, router, sessionToken]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");

    const validationError = validateUsername(username);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!usernameOk) {
      setError("Please choose an available username.");
      return;
    }
    if (!sessionToken) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(apiUrl("/auth/username"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ username }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Could not save your username. Please try again.");
        return;
      }

      if (role === "seeker") {
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        };
        await fetch(apiUrl("/recruit/auth/profile"), {
          method: "PATCH",
          headers,
          body: JSON.stringify({ role, username, email: authUser?.email ?? "" }),
        });
        await fetch(apiUrl("/recruit/seeker/profile"), {
          method: "PUT",
          headers,
          body: JSON.stringify({ username, email: authUser?.email ?? "" }),
        });
      }

      await refreshProfile();
      router.replace(nextPath);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !authUser || authUser.username?.trim()) return null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <Link href="/recruit" className="flex items-center gap-2 group">
            <RoleboltLogo size="sm" className="group-hover:scale-105 transition-all" />
            <span className="text-sm font-bold text-slate-900">Rolebolt</span>
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            Sign out
          </button>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[420px] rounded-2xl bg-white border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.07)] p-8">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0a66c2]/10 text-[#0a66c2]">
            <span className="text-2xl font-black">@</span>
          </div>
          <h1 className="text-2xl font-extrabold text-center text-slate-950 tracking-tight">
            Choose your username
          </h1>
          <p className="text-sm text-slate-500 text-center leading-relaxed mt-2 mb-7">
            Your username is your unique Rolebolt identity and will be used in your public profile URL.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <UsernameField
              value={username}
              onChange={(value) => { setUsername(value); setError(""); }}
              onValidChange={setUsernameOk}
              accent="recruit"
            />
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl bg-[#0a66c2] text-sm font-bold text-white hover:bg-[#004182] disabled:opacity-60 transition-all shadow-[0_2px_10px_rgba(10,102,194,0.28)]"
            >
              {submitting ? "Saving username…" : "Continue to dashboard"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Spinner() {
  return <div className="min-h-screen bg-[#f0f2f5]" />;
}

export default function ChooseUsernamePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ChooseUsernameContent />
    </Suspense>
  );
}