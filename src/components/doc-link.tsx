"use client";

import { Link, usePathname } from "@/i18n/navigation";

export function DocLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition lg:rounded-xl ${
        active ? "bg-brand-soft text-brand-ink" : "text-muted hover:bg-brand-soft hover:text-brand-ink"
      }`}
    >
      {label}
    </Link>
  );
}
