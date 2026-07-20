"use client";

import type { ReactNode } from "react";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "./ToastProvider";
import { AuthProvider } from "./AuthProvider";
import { SettingsProvider } from "./SettingsProvider";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

export default function AppProviders({ children, initialSettings = DEFAULT_SETTINGS }: { children: ReactNode; initialSettings?: AppSettings }) {
  return (
    <AuthProvider>
      <SettingsProvider initialSettings={initialSettings}>
        <ToastProvider>
          {children}
          <CommandPalette />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
