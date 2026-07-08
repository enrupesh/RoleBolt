"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebaseClient";
import { apiUrl, readApiJson } from "@/lib/api";

type MatchResult = {
  matchScore: number;
  matchReasons: string[];
  missingSkills: string[];
  profileSuggestions: string[];
};

type SeekerProfile = {
  skills: string[];
  preferredNiche: string;
  preferredWorkMode: string;
  preferredLocation: string;
  preferredSalaryMin?: number | "";
  preferredSalaryMax?: number | "";
  experienceLevel: string;
  resumeText: string;
};

function ScoreRing({ score }: { score: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 75 ? "#16a34a" : score >= 50 ? "#d97706" : "#94a3b8";
  const label = score >= 75 ? "Strong match" : score >= 50 ? "Partial match" : "Low match";
  const bgColor = score >= 75 ? "bg-green-50 border-green-200" : score >= 50 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200";
  const textColor = score >= 75 ? "text-green-700" : score >= 50 ? "text-amber-600" : "text-slate-500";

  return (
    <div className={`inline-flex flex-col items-center justify-center rounded-2xl border px-5 py-3 gap-1 ${bgColor}`}>
      <div className="relative w-16 h-16">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={radius} stroke="#e2e8f0" strokeWidth="8" fill="none" />
          <circle
            cx="44" cy="44" r={radius}
            stroke={strokeColor} strokeWidth="8" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-lg font-black ${textColor}`}>{score}%</span>
        </div>
      </div>
      <span className={`text-[11px] font-bold ${textColor}`}>{label}</span>
    </div>
  );
}

async function loadProfileFromDB(token: string): Promise<SeekerProfile | null> {
  try {
    const res = await fetch(apiUrl("/recruit/seeker/profile"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await readApiJson(res);
    const p = data.profile;
    if (!p) return null;
    return {
      skills: Array.isArray(p.skills) ? p.skills : [],
      preferredNiche: p.preferredNiche || "",
      preferredWorkMode: p.preferredWorkMode || "",
      preferredLocation: p.preferredLocation || "",
      preferredSalaryMin: p.preferredSalaryMin || "",
      preferredSalaryMax: p.preferredSalaryMax || "",
      experienceLevel: p.experienceLevel || "",
      resumeText: p.resumeText || "",
    };
  } catch {
    return null;
  }
}

function getProfileFromStorage(): SeekerProfile | null {
  try {
    const resumeText = localStorage.getItem("recruit_resume_text") || "";
    const raw = localStorage.getItem("recruit_seeker_profile");
    if (!raw && !resumeText) return null;
    const p = raw ? JSON.parse(raw) : {};
    const skills = Array.isArray(p.skills) ? p.skills : [];
    if (skills.length === 0 && !resumeText) return null;
    return {
      skills,
      preferredNiche: p.preferredNiche || "",
      preferredWorkMode: p.preferredWorkMode || "",
      preferredLocation: p.preferredLocation || "",
      preferredSalaryMin: p.preferredSalaryMin || "",
      preferredSalaryMax: p.preferredSalaryMax || "",
      experienceLevel: p.experienceLevel || "",
      resumeText,
    };
  } catch {
    return null;
  }
}

export default function JobMatchPanel({ jobId }: { jobId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "no-profile" | "error">("idle");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [error, setError] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [profileSource, setProfileSource] = useState<"local" | "db" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const local = getProfileFromStorage();
    if (!local) {
      setState("no-profile");
    } else {
      setProfileSource("local");
    }

    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      if (u) {
        const t = await u.getIdToken();
        if (!cancelled) setToken(t);
        if (!local && !cancelled) {
          const dbProfile = await loadProfileFromDB(t);
          if (!cancelled && dbProfile && (dbProfile.skills.length > 0 || dbProfile.resumeText)) {
            setState("idle");
            setProfileSource("db");
          }
        }
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  async function analyze() {
    setState("loading");
    setError("");
    try {
      let profile: SeekerProfile | null = getProfileFromStorage();

      if (!profile && token) {
        profile = await loadProfileFromDB(token);
        if (profile) setProfileSource("db");
      }

      if (!profile || (profile.skills.length === 0 && !profile.resumeText)) {
        setState("no-profile");
        return;
      }

      const res = await fetch(apiUrl(`/recruit-public/jobs/${jobId}/match`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: profile.skills,
          resumeText: profile.resumeText,
          preferredNiche: profile.preferredNiche,
          preferredWorkMode: profile.preferredWorkMode,
          preferredLocation: profile.preferredLocation,
          preferredSalaryMin: profile.preferredSalaryMin ? Number(profile.preferredSalaryMin) : undefined,
          preferredSalaryMax: profile.preferredSalaryMax ? Number(profile.preferredSalaryMax) : undefined,
          experienceLevel: profile.experienceLevel,
        }),
      });

      if (!res.ok) {
        const d = await readApiJson(res);
        throw new Error(d.error || "Analysis failed.");
      }

      const data: MatchResult = await readApiJson(res);
      setResult(data);
      setState("done");
    } catch (e: any) {
      setError(e.message);
      setState("error");
    }
  }

  if (state === "no-profile") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white text-base">✨</div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-900">See why this job matches you</h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Set up your profile once — add your skills, experience level, and preferences — and get an instant AI breakdown of how well any job fits you.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/recruit/profile"
                className="inline-flex rounded-full bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white hover:bg-[#004182] transition"
              >
                Set up profile
              </Link>
              <Link
                href="/login?next=/recruit/profile"
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Skills match", "Experience fit", "Salary check", "Missing skills"].map(tag => (
                <span key={tag} className="rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-500">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl bg-[#0a66c2] text-white text-base">✨</div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-900">Why this job matches you</h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Get an AI-powered breakdown of how well this role fits your profile — skills, experience level, work mode, location, and salary.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <button
                onClick={analyze}
                className="inline-flex rounded-full bg-[#0a66c2] px-4 py-2 text-xs font-bold text-white hover:bg-[#004182] transition active:scale-95"
              >
                Analyze my match
              </button>
              {profileSource === "db" && (
                <span className="text-[10px] text-slate-400">Using your saved profile</span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Skills", "Experience level", "Niche", "Location", "Salary"].map(tag => (
                <span key={tag} className="rounded-full bg-white/80 border border-blue-200 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "loading") {
    return (
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 p-5 shadow-sm">
        <div className="flex items-center gap-3 text-[#0a66c2]">
          <svg className="animate-spin h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <div>
            <p className="text-sm font-bold text-slate-900">Analyzing your match…</p>
            <p className="text-xs text-slate-500 mt-0.5">Comparing your profile to this role's requirements</p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 shadow-sm">
        <p className="text-sm font-semibold text-red-700">Could not analyze match</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <button onClick={() => setState("idle")} className="mt-3 text-xs font-semibold text-[#0a66c2] hover:underline">Try again</button>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-base">✨</span>
            <h2 className="text-sm font-bold text-slate-900">Your match score</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">Based on your skills, experience level, preferences, and resume</p>
          {profileSource === "db" && (
            <p className="mt-0.5 text-[10px] text-slate-400">Using your saved profile from the server</p>
          )}
        </div>
        <ScoreRing score={result.matchScore} />
      </div>

      {result.matchReasons.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Why this job fits you</h3>
          <ul className="space-y-2">
            {result.matchReasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 text-[10px] font-bold">✓</span>
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.missingSkills.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Skills to develop</h3>
          <div className="flex flex-wrap gap-1.5">
            {result.missingSkills.map((skill, i) => (
              <span key={i} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.profileSuggestions.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">How to improve your chances</h3>
          <ul className="space-y-2">
            {result.profileSuggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-600 leading-relaxed">
                <span className="mt-0.5 text-[#0a66c2] font-bold shrink-0">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <Link href="/recruit/profile" className="text-xs font-semibold text-[#0a66c2] hover:underline">Update your profile</Link>
        <button onClick={analyze} className="text-xs text-slate-400 hover:text-slate-600 transition">Refresh analysis</button>
      </div>
    </div>
  );
}
