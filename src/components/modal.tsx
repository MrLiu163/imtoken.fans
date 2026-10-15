"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "next-intl";

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClassName = "max-w-md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  widthClassName?: string;
}) {
  const t = useTranslations("common");
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={`relative max-h-[85vh] w-full ${widthClassName} overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-xl`}
      >
        {title && (
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="rounded-full p-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
