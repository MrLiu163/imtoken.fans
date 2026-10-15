"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moderateQueueItem } from "@/app/admin/actions";
import { EmptyState, TimeAgo } from "@/components/admin/ui";
import type { QueueItem } from "@/lib/admin-data";

const SOURCE_LABEL: Record<string, string> = { human: "人工队列", ai: "AI 待复核" };
const TARGET_LABEL: Record<string, string> = { submission: "提交", comment: "评论" };

export function ModerationQueuePanel({ items: initialItems }: { items: QueueItem[] }) {
  const router = useRouter();
  // 处理完的条目要立刻从列表里消失，所以本地留一份「已处理的 id」，
  // 服务端 revalidate 回来后自然就对上了。
  const [handledIds, setHandledIds] = useState<string[]>([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const items = initialItems.filter((item) => !handledIds.includes(item.id));

  function handleDecision(queueId: string, decision: "approved" | "rejected") {
    setError(null);
    setPendingId(queueId);
    startTransition(async () => {
      const result = await moderateQueueItem(queueId, decision);
      setPendingId(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHandledIds((prev) => [...prev, queueId]);
      router.refresh();
    });
  }

  if (items.length === 0) return <EmptyState>没有待审核的内容。</EmptyState>;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-risk">{error}</p>}
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-2 py-0.5 font-mono text-[10px] font-medium text-brand-ink">
                {TARGET_LABEL[item.target_type]} · {SOURCE_LABEL[item.source]}
              </span>
              <span className="font-mono text-[11px] text-faint">
                {item.author_username ?? "未知用户"} · <TimeAgo iso={item.created_at} />
              </span>
            </div>
            <p className="mt-1 truncate text-sm text-ink" title={item.preview}>
              {item.preview}
            </p>
            {item.reason && <p className="mt-0.5 text-xs text-muted">AI 判定理由：{item.reason}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              disabled={isPending && pendingId === item.id}
              onClick={() => handleDecision(item.id, "approved")}
              className="rounded-full bg-good px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              通过
            </button>
            <button
              type="button"
              disabled={isPending && pendingId === item.id}
              onClick={() => handleDecision(item.id, "rejected")}
              className="rounded-full bg-risk px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              驳回
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
