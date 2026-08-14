"use client";

import { useState } from "react";
import {
  adminFetch,
  type AdminUserLookup,
} from "@/lib/raka98Admin";

type BillingCategory = "seeker" | "creator_form" | "creator_standard";

const CATEGORY_OPTIONS: { id: BillingCategory; label: string }[] = [
  { id: "seeker", label: "Job Seeker" },
  { id: "creator_form", label: "Form Jobs" },
  { id: "creator_standard", label: "Standard Jobs" },
];

function planLabel(plan: string) {
  if (plan === "ultra") return "Ultra Pro";
  if (plan === "pro") return "Pro";
  return "Free";
}

export function PlanGrantAdminPanel() {
  const [query, setQuery] = useState("");
  const [user, setUser] = useState<AdminUserLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [selectedCategories, setSelectedCategories] = useState<BillingCategory[]>([
    "seeker",
    "creator_form",
    "creator_standard",
  ]);
  const [plan, setPlan] = useState<"pro" | "ultra">("pro");
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [note, setNote] = useState("");

  async function lookupUser(event?: React.FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const data = await adminFetch(`/admin/users/lookup?q=${encodeURIComponent(query.trim())}`);
      setUser(data.user as AdminUserLookup);
    } catch (err: unknown) {
      setUser(null);
      setError(err instanceof Error ? err.message : "User not found.");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(category: BillingCategory) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  }

  async function grantPlan() {
    if (!user) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await adminFetch(`/admin/users/${encodeURIComponent(user.uid)}/plans/grant`, {
        method: "POST",
        body: JSON.stringify({
          plan,
          interval,
          categories: selectedCategories,
          note,
        }),
      });
      setUser(data.user as AdminUserLookup);
      setMessage(String(data.message || "Plan granted."));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to grant plan.");
    } finally {
      setBusy(false);
    }
  }

  async function revokePlan() {
    if (!user) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await adminFetch(`/admin/users/${encodeURIComponent(user.uid)}/plans/revoke`, {
        method: "POST",
        body: JSON.stringify({
          categories: selectedCategories,
          note,
        }),
      });
      setUser(data.user as AdminUserLookup);
      setMessage(String(data.message || "Plan revoked."));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to revoke plan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30 mb-2">
          Plan management
        </p>
        <h2 className="text-2xl font-semibold text-white/90 tracking-tight">
          Grant Pro / Ultra Pro
        </h2>
        <p className="mt-2 text-sm text-white/45 max-w-2xl">
          Look up any user by email or username, then grant or revoke paid plans per category — Job Seeker, Form Jobs, and/or Standard Jobs.
        </p>
      </div>

      <form onSubmit={lookupUser} className="flex flex-col sm:flex-row gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Email or username"
          className="flex-1 rounded-xl border border-white/10 bg-[#111118] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/25"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-white text-black px-5 py-3 text-sm font-semibold hover:bg-white/90 disabled:opacity-50 transition"
        >
          {loading ? "Searching…" : "Find user"}
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      {user && (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/6">
            <h3 className="text-base font-semibold text-white/90">{user.name || user.username || user.email}</h3>
            <p className="text-sm text-white/45 mt-1">
              {user.email || "No email"} {user.username ? `· @${user.username}` : ""}
            </p>
            <p className="text-[11px] text-white/25 font-mono mt-2">UID: {user.uid}</p>
          </div>

          <div className="px-5 py-4 grid gap-3 sm:grid-cols-3 border-b border-white/6">
            {user.entitlements.map((item) => (
              <div key={item.category} className="rounded-lg border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wide text-white/35">
                  {CATEGORY_OPTIONS.find((option) => option.id === item.category)?.label || item.category}
                </p>
                <p className="mt-1 text-sm font-semibold text-white/85">{planLabel(item.plan)}</p>
                <p className="text-xs text-white/40 mt-1 capitalize">{item.status}</p>
                {item.periodEnd && (
                  <p className="text-[11px] text-white/30 mt-1">
                    Until {new Date(item.periodEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">Categories</p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((option) => {
                  const checked = selectedCategories.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleCategory(option.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                        checked
                          ? "bg-white text-black border-white"
                          : "border-white/10 text-white/45 hover:border-white/20"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">Plan</p>
                <div className="flex gap-2">
                  {(["pro", "ultra"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setPlan(value)}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                        plan === value
                          ? "bg-[#0a66c2] border-[#0a66c2] text-white"
                          : "border-white/10 text-white/45 hover:border-white/20"
                      }`}
                    >
                      {value === "pro" ? "Pro" : "Ultra Pro"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">Billing interval</p>
                <div className="flex gap-2">
                  {(["monthly", "yearly"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterval(value)}
                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold border transition ${
                        interval === value
                          ? "bg-white text-black border-white"
                          : "border-white/10 text-white/45 hover:border-white/20"
                      }`}
                    >
                      {value === "monthly" ? "Monthly" : "Yearly"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/35 mb-2">Admin note (optional)</p>
              <input
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why this grant was given"
                className="w-full rounded-xl border border-white/10 bg-[#111118] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25"
              />
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy || selectedCategories.length === 0}
                onClick={grantPlan}
                className="rounded-xl bg-emerald-500 text-black px-5 py-2.5 text-sm font-bold hover:bg-emerald-400 disabled:opacity-50 transition"
              >
                {busy ? "Saving…" : "Grant plan"}
              </button>
              <button
                type="button"
                disabled={busy || selectedCategories.length === 0}
                onClick={revokePlan}
                className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 px-5 py-2.5 text-sm font-semibold hover:bg-red-500/15 disabled:opacity-50 transition"
              >
                Reset to Free
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
