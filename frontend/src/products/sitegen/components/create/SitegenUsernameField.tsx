"use client";

import { useEffect, useState } from "react";
import { checkSitegenUsername } from "../../lib/client";
import { normalizeSitegenUsernameInput, validateSitegenUsername } from "../../lib/username";
import { sitegenDisplayPublicUrl } from "../../lib/publicUrl";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
};

export function SitegenUsernameField({ id = "sitegen-username", value, onChange, onValidChange }: Props) {
  const [availability, setAvailability] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [serverError, setServerError] = useState("");

  const normalized = normalizeSitegenUsernameInput(value);
  const formatError = value.trim() ? validateSitegenUsername(value) : null;

  useEffect(() => {
    onValidChange?.(!formatError && normalized.length >= 3 && availability === "available");
  }, [formatError, normalized, availability, onValidChange]);

  useEffect(() => {
    if (!normalized || formatError) {
      setAvailability(formatError ? "invalid" : "idle");
      setServerError(formatError || "");
      return;
    }

    setAvailability("checking");
    setServerError("");
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const data = await checkSitegenUsername(normalized);
        if (!active) return;
        if (!data.available) {
          setAvailability("taken");
          setServerError(data.error || "This username is already taken.");
        } else {
          setAvailability("available");
          setServerError("");
        }
      } catch {
        if (active) {
          setAvailability("idle");
          setServerError("We couldn't check that username right now. Please try again.");
        }
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [normalized, formatError]);

  const statusMessage = (() => {
    if (!normalized) return `Your site will live at ${sitegenDisplayPublicUrl("yourname")}`;
    if (formatError || serverError) return formatError || serverError;
    if (availability === "checking") return "Checking availability…";
    if (availability === "available") return "This username is available.";
    if (availability === "taken") return "This username is not available.";
    return `Your site will live at ${sitegenDisplayPublicUrl(normalized)}`;
  })();

  const statusColor = availability === "available"
    ? "text-emerald-300"
    : formatError || serverError || availability === "taken"
      ? "text-red-300"
      : "text-violet-200/50";

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-[.12em] text-violet-200/70">
        Username
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-violet-200/40">@</span>
        <input
          id={id}
          type="text"
          autoComplete="username"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(normalizeSitegenUsernameInput(event.target.value))}
          placeholder="alexsharma"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-8 pr-3.5 text-sm text-white outline-none placeholder:text-violet-200/30 focus:border-violet-400/50"
          required
        />
      </div>
      <p className={`text-xs leading-5 ${statusColor}`}>{statusMessage}</p>
    </div>
  );
}
