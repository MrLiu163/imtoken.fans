"use client";

import { useState, useTransition } from "react";
import { updateModerationMode } from "@/app/admin/actions";
import type { ModerationMode, ModerationTargetType } from "@/lib/moderation/settings";

const MODE_LABEL: Record<ModerationMode, string> = { none: "不审核", human: "人工审核", ai: "AI 审核" };
const TARGET_LABEL: Record<ModerationTargetType, string> = { submission: "提交（产品/点子）", comment: "评论" };

export function ModerationSettingsPanel({
  initialModes,
  aiConfigured,
}: {
  initialModes: Record<ModerationTargetType, ModerationMode>;
  aiConfigured: boolean;
}) {
  const [modes, setModes] = useState(initialModes);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(targetType: ModerationTargetType, mode: ModerationMode) {
    setError(null);
    const previous = modes[targetType];
    setModes((m) => ({ ...m, [targetType]: mode }));
    startTransition(async () => {
      const result = await updateModerationMode(targetType, mode);
      if (result.error) {
        setModes((m) => ({ ...m, [targetType]: previous }));
        setError(result.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink">内容审核设置</p>
      <p className="mt-1 text-sm text-muted">
        AI 审核需要先在 .env.local 配置 AI_MODERATION_API_KEY，审核标准写在 src/lib/moderation/prompts/ 下的文件里。
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {(["submission", "comment"] as ModerationTargetType[]).map((targetType) => (
          <div key={targetType} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
            <span className="text-sm font-medium text-ink">{TARGET_LABEL[targetType]}</span>
            <div className="flex gap-1.5">
              {(["none", "human", "ai"] as ModerationMode[]).map((mode) => {
                const disabled = mode === "ai" && !aiConfigured;
                return (
                  <button
                    key={mode}
                    type="button"
                    disabled={disabled || isPending}
                    title={disabled ? "需要先配置 AI_MODERATION_API_KEY" : undefined}
                    onClick={() => handleChange(targetType, mode)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      modes[targetType] === mode
                        ? "bg-brand text-white"
                        : "border border-line text-muted hover:border-brand hover:text-brand-ink"
                    }`}
                  >
                    {MODE_LABEL[mode]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 text-xs text-risk">{error}</p>}
    </div>
  );
}
