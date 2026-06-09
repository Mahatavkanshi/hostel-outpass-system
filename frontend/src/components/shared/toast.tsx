"use client";

import { X } from "lucide-react";
import { createContext, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";
type Toast = {
  id: string;
  kind: ToastKind;
  title: string;
  body?: string;
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
  showError: (error: unknown, title?: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function remove(id: string) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast(toast) {
        const id = crypto.randomUUID();
        setToasts((current) => [...current, { ...toast, id }].slice(-4));
        window.setTimeout(() => remove(id), 4500);
      },
      showError(error, title = "Something went wrong") {
        const body = error instanceof Error ? error.message : String(error);
        const id = crypto.randomUUID();
        const toast: Toast = { id, kind: "error", title, body };
        setToasts((current) => [...current, toast].slice(-4));
        window.setTimeout(() => remove(id), 5500);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[80] grid w-[min(24rem,calc(100vw-2rem))] gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-lg border bg-white p-3 text-sm shadow-lg ${
              toast.kind === "error"
                ? "border-red-200"
                : toast.kind === "success"
                  ? "border-emerald-200"
                  : "border-zinc-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{toast.title}</p>
                {toast.body && (
                  <p className="mt-1 text-zinc-600">{toast.body}</p>
                )}
              </div>
              <button
                className="text-zinc-400 hover:text-zinc-700"
                onClick={() => remove(toast.id)}
                type="button"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
