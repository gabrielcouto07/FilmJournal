"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };
type ToastContextValue = { notify: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3200);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);

  return <ToastContext.Provider value={value}>
    {children}
    <div className="pointer-events-none fixed bottom-5 right-4 z-[80] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => <div key={toast.id} className={`toast-enter pointer-events-auto rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl ${toast.tone === "error" ? "border-red-300/25 bg-[#291518]/95 text-red-100" : toast.tone === "info" ? "border-blue-300/25 bg-[#111e29]/95 text-blue-100" : "border-amber-300/25 bg-[#241d05]/95 text-amber-100"}`}>{toast.message}</div>)}
    </div>
  </ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
