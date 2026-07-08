"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";

export type Theme = "white" | "light" | "dark" | "green" | "reading" | "ocean" | "rose" | "auto";

export const THEME_STORAGE_KEY = "plyndrox_theme";
const LEGACY_STORAGE_KEY = "evara_theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "white",
  setTheme: () => {},
});

function normalizeTheme(theme: Theme | null): Theme {
  if (!theme) return "white";
  if (theme === "light") return "white";
  if (!["white", "dark", "green", "reading", "ocean", "rose", "auto"].includes(theme)) return "white";
  return theme;
}

function resolveTheme(theme: Theme): Exclude<Theme, "auto" | "light"> {
  if (theme === "auto") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "white";
  }
  return normalizeTheme(theme) as Exclude<Theme, "auto" | "light">;
}

function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute("data-theme", resolved);
  document.body.classList.add("app-theme");
  document.body.setAttribute("data-theme", resolved);
  const themeColor = getComputedStyle(document.documentElement).getPropertyValue("--background").trim() || "#ffffff";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

function readStoredTheme(): Theme {
  const stored = normalizeTheme(
    (localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as Theme | null
  );
  localStorage.setItem(THEME_STORAGE_KEY, stored);
  return stored;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("white");

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);

    const handler = (e: Event) => {
      const t = normalizeTheme((e as CustomEvent<Theme>).detail);
      setThemeState(t);
      applyTheme(t);
    };
    window.addEventListener("evara-theme-change", handler);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const mqHandler = () => {
      const current = readStoredTheme();
      if (current === "auto") applyTheme("auto");
    };
    mq.addEventListener("change", mqHandler);

    return () => {
      window.removeEventListener("evara-theme-change", handler);
      mq.removeEventListener("change", mqHandler);
    };
  }, []);

  function setTheme(t: Theme) {
    const nextTheme = normalizeTheme(t);
    setThemeState(nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    localStorage.setItem(LEGACY_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new CustomEvent<Theme>("evara-theme-change", { detail: nextTheme }));
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function applyThemeFromStorage() {
  try {
    const stored = normalizeTheme(
      (localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY)) as Theme | null
    );
    const resolved = resolveTheme(stored);
    document.documentElement.setAttribute("data-theme", resolved);
  } catch {}
}
