import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { levelProgress, levelTier, levelTierName, MAX_LEVEL } from "@/lib/level";
import { LevelMedal } from "@/components/level-badge";

// 经验条。纯展示组件，服务端组件里直接用。
//
// 「自己能看见还剩多少经验升级，别人只能看见经验值」这条规则由 variant 控制：
//   own    —— 个人中心：奖牌 + 进度条 + 还差多少升级
//   public —— 别人的主页：只显示当前等级和经验总量，不显示进度和差额

export function LevelCard({
  xp,
  level,
  variant = "own",
  className = "",
}: {
  xp: number;
  level: number | null | undefined;
  variant?: "own" | "public";
  className?: string;
}) {
  const t = useTranslations("levels");
  const locale = useLocale();
  const progress = levelProgress(xp, level);
  const tier = levelTier(progress.level);
  const isMax = progress.level >= MAX_LEVEL;

  return (
    <div className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center gap-4">
        <LevelMedal level={progress.level} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-base font-bold text-ink">{levelTierName(progress.level, locale)}</p>
            <p className="font-mono text-xs text-faint">
              {progress.xp.toLocaleString()} XP
            </p>
          </div>

          {variant === "own" ? (
            isMax ? (
              <p className="mt-0.5 text-xs text-muted">{t("maxLevelReached")}</p>
            ) : (
              <p className="mt-0.5 text-xs text-muted">
                {t.rich("xpToNext", {
                  xp: progress.xpToNext.toLocaleString(),
                  next: progress.level + 1,
                  amount: (chunks) => (
                    <span className="font-mono font-semibold text-ink">{chunks}</span>
                  ),
                })}
              </p>
            )
          ) : (
            <p className="mt-0.5 text-xs text-muted">{t("communityLevel")}</p>
          )}
        </div>

        {/* 两个入口分工：想知道"怎么涨"去 FAQ 看规则，想立刻涨去活动中心。
            规则放在前面——看到经验条的人第一反应通常是"这怎么算的"。 */}
        {variant === "own" && (
          <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
            <Link
              href="/faq#xp"
              className="rounded-full border border-line px-3 py-1.5 text-center text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand-ink"
            >
              {t("viewRules")}
            </Link>
            <Link
              href="/activities"
              className="rounded-full bg-brand-soft px-3 py-1.5 text-center text-xs font-semibold text-brand-ink transition-colors hover:bg-brand hover:text-white"
            >
              {t("earnXp")}
            </Link>
          </div>
        )}
      </div>

      {variant === "own" && (
        <div className="mt-4">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              style={{ width: `${Math.max(progress.percent, isMax ? 100 : 2)}%`, background: tier.gradient }}
              className="h-full rounded-full transition-[width] duration-500"
            />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-faint">
            <span>Lv{progress.level} · {progress.currentLevelXp.toLocaleString()}</span>
            <span>
              {isMax ? "MAX" : `Lv${progress.level + 1} · ${progress.nextLevelXp?.toLocaleString()}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
