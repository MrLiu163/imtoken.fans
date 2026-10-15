import { useLocale } from "next-intl";
import { clampLevel, levelTier, levelTierName } from "@/lib/level";

// 等级徽章：纯展示、无状态、不带 "use client"，服务端组件和客户端组件都能直接用。
//
// 渐变色写成 style 而不是 Tailwind 类名：类名如果是按等级动态拼出来的
// （比如 `from-${color}`），Tailwind 的扫描器看不到，编译产物里就没有这些类。
//
// 尺寸档位的用途：
//   xs —— 评论区名字旁边、用户卡片这类已经很挤的地方
//   sm —— 默认，列表/详情页
//   md —— 个人中心的等级卡

type BadgeSize = "xs" | "sm" | "md";

const SIZE_CLASS: Record<BadgeSize, string> = {
  xs: "h-[16px] px-1.5 text-[9px] gap-0.5",
  sm: "h-[20px] px-2 text-[11px] gap-1",
  md: "h-[26px] px-2.5 text-[13px] gap-1",
};

export function LevelBadge({
  level,
  size = "sm",
  showName = false,
  showIcon = true,
  className = "",
}: {
  level: number | null | undefined;
  size?: BadgeSize;
  /** 显示称号（"猎手"）。空间紧张的地方关掉，只留 Lv 数字 */
  showName?: boolean;
  showIcon?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const lv = clampLevel(level);
  const tier = levelTier(lv);
  const name = levelTierName(lv, locale);

  return (
    <span
      title={`Lv${lv} · ${name}`}
      style={{ background: tier.gradient }}
      className={`inline-flex shrink-0 items-center rounded-full font-bold leading-none text-white shadow-sm ${SIZE_CLASS[size]} ${className}`}
    >
      {showIcon && <span aria-hidden>{tier.icon}</span>}
      <span className="font-mono tracking-tight">Lv{lv}</span>
      {showName && <span className="font-sans font-semibold">{name}</span>}
    </span>
  );
}

// 大号奖牌，用在个人中心/公开主页的等级卡上。等级越高光晕越明显，
// 满级（彩虹渐变）本身就够扎眼，不用额外加东西。
export function LevelMedal({ level, className = "" }: { level: number | null | undefined; className?: string }) {
  const locale = useLocale();
  const lv = clampLevel(level);
  const tier = levelTier(lv);

  return (
    <span
      title={`Lv${lv} · ${levelTierName(lv, locale)}`}
      style={{
        background: tier.gradient,
        boxShadow: `0 6px 20px -6px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,.45)`,
      }}
      className={`inline-flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl text-white ${className}`}
    >
      <span className="text-base leading-none" aria-hidden>
        {tier.icon}
      </span>
      <span className="mt-0.5 font-mono text-[13px] font-bold leading-none">Lv{lv}</span>
    </span>
  );
}
