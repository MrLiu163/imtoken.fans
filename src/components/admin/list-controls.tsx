"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// 筛选和翻页都写进 URL 查询参数，而不是组件里的本地 state：
// 服务端分页/搜索需要参数才能查（见 admin-data.ts），写进 URL 顺带就能分享和后退。

function useSetParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return function setParams(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    // 改筛选条件时把页码归零，否则从第 3 页切筛选会落到一个空页上。
    if (!("page" in patch)) next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };
}

export function SearchInput({
  paramKey = "q",
  placeholder,
}: {
  paramKey?: string;
  placeholder: string;
}) {
  const searchParams = useSearchParams();
  const setParams = useSetParams();
  const urlValue = searchParams.get(paramKey) ?? "";
  const [value, setValue] = useState(urlValue);
  const [syncedValue, setSyncedValue] = useState(urlValue);
  const [isPending, startTransition] = useTransition();

  // 浏览器后退/前进、或者点了「清空」时 URL 变了，输入框要跟着回到 URL 里的值。
  // 用「渲染期间调整 state」而不是 useEffect：后者会多跑一轮渲染，
  // 而且 React 明确推荐这种写法处理「prop 变了就重置 state」（you-might-not-need-an-effect）。
  if (syncedValue !== urlValue) {
    setSyncedValue(urlValue);
    setValue(urlValue);
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(() => setParams({ [paramKey]: value.trim() || null }));
      }}
      className="flex min-w-0 flex-1 items-center gap-2"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3.5 py-1.5 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="shrink-0 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-60"
      >
        搜索
      </button>
      {urlValue && (
        <button
          type="button"
          onClick={() => startTransition(() => setParams({ [paramKey]: null }))}
          className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
        >
          清空
        </button>
      )}
    </form>
  );
}

export function FilterTabs({
  paramKey,
  options,
  defaultValue,
}: {
  paramKey: string;
  options: { value: string; label: string; count?: number }[];
  defaultValue: string;
}) {
  const searchParams = useSearchParams();
  const setParams = useSetParams();
  const active = searchParams.get(paramKey) ?? defaultValue;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setParams({ [paramKey]: option.value === defaultValue ? null : option.value })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            active === option.value
              ? "bg-brand text-white"
              : "border border-line text-muted hover:border-brand hover:text-brand-ink"
          }`}
        >
          {option.label}
          {option.count !== undefined && <span className="ml-1 font-mono opacity-70">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
      <p className="font-mono text-[11px] text-faint">
        {from}-{to} / 共 {total} 条
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
          上一页
        </PageLink>
        <span className="font-mono text-[11px] text-muted">
          {page} / {totalPages}
        </span>
        <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages}>
          下一页
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  const base = "rounded-full border border-line px-3 py-1 text-xs font-medium transition-colors";
  if (disabled) return <span className={`${base} cursor-not-allowed text-faint opacity-50`}>{children}</span>;
  return (
    <Link href={href} className={`${base} text-muted hover:border-brand hover:text-brand-ink`}>
      {children}
    </Link>
  );
}
