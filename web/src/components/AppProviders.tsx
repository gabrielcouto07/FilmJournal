"use client";

import type { ReactNode } from "react";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "./ToastProvider";
import { AuthProvider, type AuthUser } from "./AuthProvider";
import { SettingsProvider } from "./SettingsProvider";
import { DEFAULT_SETTINGS, type AppSettings } from "@/lib/settings";

export default function AppProviders({
  children,
  initialSettings = DEFAULT_SETTINGS,
  initialUser = null,
}: {
  children: ReactNode;
  initialSettings?: AppSettings;
  initialUser?: AuthUser | null;
}) {
  return (
    <AuthProvider initialUser={initialUser}>
      <SettingsProvider initialSettings={initialSettings}>
        <ToastProvider>
          {children}
          <CommandPalette />
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
