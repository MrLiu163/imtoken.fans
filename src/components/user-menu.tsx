"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import NextLink from "next/link";
import { Link } from "@/i18n/navigation";
import { Avatar } from "@/components/avatar";

export function UserMenu({
  name,
  avatarUrl,
  isAdmin,
  onSignOut,
}: {
  name: string;
  avatarUrl?: string | null;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="group relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("accountMenu")}
        className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft font-display text-sm font-bold text-brand-ink transition-colors hover:ring-2 hover:ring-brand/30"
      >
        <Avatar src={avatarUrl} name={name} className="h-full w-full" />
      </button>

      <div
        className={`absolute right-0 top-full z-50 w-52 pt-2 transition-all group-hover:visible group-hover:opacity-100 ${
          open ? "visible opacity-100" : "invisible opacity-0"
        }`}
      >
        <div className="rounded-xl border border-line bg-surface p-1.5 shadow-lg">
          <p className="truncate px-3 py-2 text-sm font-semibold text-ink">{name}</p>
          <div className="my-1 h-px bg-line" />
          <MenuLink href="/profile" onClick={() => setOpen(false)}>
            {t("profile")}
          </MenuLink>
          {isAdmin && (
            <MenuLink href="/admin" localized={false} onClick={() => setOpen(false)}>
              {t("admin")}
            </MenuLink>
          )}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-risk transition-colors hover:bg-risk-soft"
          >
            {t("signOut")}
          </button>
        </div>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  children,
  localized = true,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
  localized?: boolean;
}) {
  const className = "block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-2";
  // 后台不在 [locale] 段下。next-intl 的 Link 会把 /admin 加成 /zh/admin，那个路由不存在。
  if (!localized) {
    return (
      <NextLink href={href} onClick={onClick} className={className}>
        {children}
      </NextLink>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
