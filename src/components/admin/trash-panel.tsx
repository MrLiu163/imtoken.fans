"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeTrashItem, restoreTrashItem } from "@/app/admin/actions";
import { EmptyState, TimeAgo } from "@/components/admin/ui";
import type { TrashItem } from "@/lib/admin-data";
import { TRASH_RETENTION_DAYS } from "@/lib/types";

// 剩余可恢复时间。expires_at = deleted_at + 7 天，由服务端算好传过来。
function remainingLabel(expiresAt: string): { text: string; urgent: boolean } {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return { text: "即将清除", urgent: true };
  const hours = Math.floor(ms / 3600000);
  if (hours < 24) return { text: `${Math.max(1, hours)} 小时后清除`, urgent: true };
  return { text: `${Math.floor(hours / 24)} 天后清除`, urgent: false };
}

export function TrashPanel({
  items: initialItems,
  viewerIsAdmin,
}: {
  items: TrashItem[];
  viewerIsAdmin: boolean;
}) {
  const router = useRouter();
  const [handledKeys, setHandledKeys] = useState<string[]>([]);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const keyOf = (item: TrashItem) => `${item.kind}:${item.id}`;
  const items = initialItems.filter((item) => !handledKeys.includes(keyOf(item)));

  function run(item: TrashItem, task: () => Promise<{ error?: string }>) {
    setError(null);
    setPendingKey(keyOf(item));
    startTransition(async () => {
      const result = await task();
      setPendingKey(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHandledKeys((prev) => [...prev, keyOf(item)]);
      router.refresh();
    });
  }

  function handleRestore(item: TrashItem) {
    run(item, () => restoreTrashItem(item.kind, item.id));
  }

  function handlePurge(item: TrashItem) {
    if (!window.confirm("彻底删除后无法恢复，确定继续？")) return;
    run(item, () => purgeTrashItem(item.kind, item.id));
  }

  if (items.length === 0) {
    return <EmptyState>回收站是空的。删除的内容会在这里保留 {TRASH_RETENTION_DAYS} 天。</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-risk">{error}</p>}
      {items.map((item) => {
        const remaining = remainingLabel(item.expires_at);
        const key = keyOf(item);
        return (
          <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-medium text-brand-ink">
                  {item.kind === "comment" ? "评论" : "内容"}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${
                    remaining.urgent ? "bg-risk-soft text-risk" : "bg-surface text-muted"
                  }`}
                >
                  {remaining.text}
                </span>
                <span className="font-mono text-[11px] text-faint">
                  {item.author_username ?? "未知用户"} · 由 {item.deleted_by_username ?? "系统"} 删除 ·{" "}
                  <TimeAgo iso={item.deleted_at} />
                </span>
              </div>

              {item.title && <p className="mt-1 truncate text-xs text-muted">{item.title}</p>}
              <p className="mt-0.5 line-clamp-2 text-sm text-ink" title={item.preview}>
                {item.preview}
              </p>
              {item.delete_reason && <p className="mt-0.5 text-xs text-muted">删除理由：{item.delete_reason}</p>}
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={isPending && pendingKey === key}
                onClick={() => handleRestore(item)}
                className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                恢复
              </button>
              {viewerIsAdmin && (
                <button
                  type="button"
                  disabled={isPending && pendingKey === key}
                  onClick={() => handlePurge(item)}
                  className="rounded-full border border-risk px-3 py-1.5 text-xs font-semibold text-risk transition-colors hover:bg-risk hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  彻底删除
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
