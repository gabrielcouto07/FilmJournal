"use client";

import type { ReactNode } from "react";
import CommandPalette from "./CommandPalette";
import { ToastProvider } from "./ToastProvider";
import { AuthProvider } from "./AuthProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        {children}
        <CommandPalette />
      </ToastProvider>
    </AuthProvider>
  );
}
