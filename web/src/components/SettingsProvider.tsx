"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";
import { applyAccent } from "@/lib/accent";

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
  // Aplica a cor de destaque e suas variações em toda a interface.
  applyAccent(root, settings.accentColor);
}

export function SettingsProvider({ initialSettings, children }: { initialSettings: AppSettings; children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(initialSettings);

  // Reaplica quando a preferência muda para atualizar a tela na hora.
  useEffect(() => { apply(settings); }, [settings]);

  // Segue o sistema quando essa opção estiver ativa.
  useEffect(() => {
    if (settings.theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => apply(settings);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [settings]);

  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}
