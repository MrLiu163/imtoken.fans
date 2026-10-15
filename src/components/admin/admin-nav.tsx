"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface AdminNavItem {
  href: string;
  label: string;
  badge?: number;
}

// 后台从「一页十个面板」拆成了多页，这条导航是页面之间唯一的入口。
// badge 上的数字是待处理量（审核队列 / 未处理举报），让人一眼看到哪里有活要干。
export function AdminNav({ items }: { items: AdminNavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              isActive ? "bg-brand text-white" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {item.label}
            {item.badge ? (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                  isActive ? "bg-white/25 text-white" : "bg-risk-soft text-risk"
                }`}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
