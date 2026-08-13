"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";
import {
  USERNAME_EXPLANATION,
  normalizeUsernameInput,
  validateUsername,
} from "@/lib/username";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  accent?: "recruit" | "seeker";
};

export function UsernameField({ id = "username", value, onChange, onValidChange, accent = "recruit" }: Props) {
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [localError, setLocalError] = useState("");

  const normalized = normalizeUsernameInput(value);
  const formatError = value.trim() ? validateUsername(value) : null;

  useEffect(() => {
    onValidChange?.(!formatError && normalized.length >= 3 && availability === "available");
  }, [formatError, normalized, availability, onValidChange]);

  useEffect(() => {
    if (!normalized || formatError) {
      setAvailability("idle");
      return;
    }

    setAvailability("checking");
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/auth/check-username?username=${encodeURIComponent(normalized)}`));
        const data = await res.json();
        if (active) setAvailability(data.available ? "available" : "taken");
      } catch {
        if (active) setAvailability("idle");
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalized, formatError]);

  const focusRing = accent === "seeker" ? "focus:border-indigo-400 focus:ring-indigo-400/20" : "focus:border-[#0a66c2] focus:ring-[#0a66c2]/15";
  const okColor = accent === "seeker" ? "text-emerald-600" : "text-emerald-600";
  const errColor = "text-red-600";

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
        Username
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">@</span>
        <input
          id={id}
          type="text"
          autoComplete="username"
          spellCheck={false}
          value={value}
          onChange={(e) => {
            onChange(normalizeUsernameInput(e.target.value));
            setLocalError("");
          }}
          placeholder="alexsharma"
          className={`w-full h-11 rounded-xl border border-slate-200 pl-8 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:ring-2 ${focusRing}`}
          required
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">{USERNAME_EXPLANATION}</p>
      {formatError && <p className={`text-xs font-medium ${errColor}`}>{formatError}</p>}
      {!formatError && normalized && availability === "checking" && (
        <p className="text-xs text-slate-400">Checking availability…</p>
      )}
      {!formatError && availability === "available" && (
        <p className={`text-xs font-medium ${okColor}`}>@{normalized} is available</p>
      )}
      {!formatError && availability === "taken" && (
        <p className={`text-xs font-medium ${errColor}`}>@{normalized} is already taken</p>
      )}
      {localError && <p className={`text-xs font-medium ${errColor}`}>{localError}</p>}
    </div>
  );
}
