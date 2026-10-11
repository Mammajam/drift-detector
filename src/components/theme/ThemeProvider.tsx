"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { THEME_KEY } from "./theme-script";

export type ThemeChoice = "light" | "dark" | "system";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeCtx = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeOsDark(onChange: () => void) {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const getOsDark = () => window.matchMedia(DARK_QUERY).matches;
const getOsDarkServer = () => false;

function readSaved(): ThemeChoice {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* storage unavailable: fall back to system */
  }
  return "system";
}

function writeSaved(choice: ThemeChoice) {
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: choice lasts for this session only */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // "system" on the server and first client render keeps hydration stable;
  // the saved choice is applied right after mount (the head script already set data-theme).
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const osDark = useSyncExternalStore(subscribeOsDark, getOsDark, getOsDarkServer);

  useEffect(() => {
    setChoiceState(readSaved());
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    writeSaved(next);
    const root = document.documentElement;
    if (next === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", next);
  }, []);

  const resolved = choice === "system" ? (osDark ? "dark" : "light") : choice;

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
