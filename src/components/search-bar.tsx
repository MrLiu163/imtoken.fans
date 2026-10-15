"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SearchBar({
  initialQuery = "",
  variant = "compact",
}: {
  initialQuery?: string;
  variant?: "hero" | "compact";
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant !== "compact") return;
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [variant]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  if (variant === "hero") {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex w-full items-center gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm sm:gap-3"
      >
        <span className="pl-2 text-lg text-faint" aria-hidden>
          🔍
        </span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("placeholderHero")}
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm text-ink placeholder:text-faint focus:outline-none sm:text-base"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink sm:px-5"
        >
          {t("button")}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="hidden w-40 shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-surface-2 px-3 py-1.5 transition-colors focus-within:border-brand/40 sm:flex lg:w-52"
    >
      <span className="shrink-0 text-xs text-faint" aria-hidden>
        🔍
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("placeholderCompact")}
        className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
      />
    </form>
  );
}
