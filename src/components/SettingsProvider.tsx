"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

type SettingsContextValue = {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
};

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  setSettings: () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

function resolveTheme(theme: AppSettings["theme"]): "dark" | "light" {
  if (theme === "system") {
    return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

function apply(settings: AppSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  root.style.setProperty("--accent", settings.accentColor);
}

export function SettingsProvider({ initialSettings, children }: { initialSettings: AppSettings; children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  // Re-apply on change (e.g. after saving preferences) so the UI updates live.
  useEffect(() => { apply(settings); }, [settings]);

  // Follow the OS when the user chose "system".
  useEffect(() => {
    if (settings.theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => apply(settings);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings]);

  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}
