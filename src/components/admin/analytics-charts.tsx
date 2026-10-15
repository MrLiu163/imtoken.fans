import Link from "next/link";
import type { ActivityPoint, BreakdownRow, DailyPoint, HourPoint } from "@/lib/analytics-data";
import { EmptyState } from "@/components/admin/ui";

// 看板的图表。全部是手写 SVG 的服务端组件——没有 "use client"，也没有引图表库：
//   * 这些图都是"一次渲染、不交互"，装 recharts 之类要多打包几百 KB 的客户端 JS
//   * 悬停提示用 SVG 原生的 <title>，浏览器自己会显示，不需要 JS
// 尺寸靠 viewBox + w-full 自适应，描边用 vectorEffect="non-scaling-stroke" 保持粗细不被缩放。

const NF = new Intl.NumberFormat("zh-CN");

export function formatCount(value: number): string {
  return NF.format(value);
}

// ========== 带环比的统计卡 ==========

export function DeltaStatCard({
  label,
  value,
  previous,
  hint,
  tone = "brand",
}: {
  label: string;
  value: number;
  previous: number;
  hint?: string;
  tone?: "brand" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${tone === "brand" ? "text-ink" : "text-muted"}`}>
        {formatCount(value)}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <Delta current={value} previous={previous} />
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/**
 * 环比。基数为 0 时不显示百分比——「从 0 涨到 3」算成 +300% 或 +∞ 都是噪音，
 * 直接说"上期 0"更诚实。
 */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return (
      <span className="font-mono text-[11px] text-faint">
        {current === 0 ? "无数据" : "上期为 0"}
      </span>
    );
  }
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.abs(pct) >= 10 ? Math.round(pct) : Math.round(pct * 10) / 10;
  const flat = Math.abs(rounded) < 0.1;
  const tone = flat ? "text-faint" : rounded > 0 ? "text-good" : "text-risk";
  const arrow = flat ? "→" : rounded > 0 ? "↑" : "↓";

  return (
    <span className={`font-mono text-[11px] font-medium ${tone}`} title={`上期 ${formatCount(previous)}`}>
      {arrow} {flat ? "持平" : `${Math.abs(rounded)}%`}
    </span>
  );
}

// ========== 访问趋势（折线 + 面积） ==========

const W = 720;
const H = 210;
const PAD = { top: 14, right: 10, bottom: 24, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function TrendChart({ daily }: { daily: DailyPoint[] }) {
  if (daily.length === 0) return <EmptyState>这段时间还没有访问数据</EmptyState>;

  const max = niceMax(Math.max(...daily.map((d) => d.views), 1));
  const x = (index: number) =>
    PAD.left + (daily.length === 1 ? PLOT_W / 2 : (index / (daily.length - 1)) * PLOT_W);
  const y = (value: number) => PAD.top + PLOT_H - (value / max) * PLOT_H;

  const viewsLine = daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.views)}`).join(" ");
  const viewsArea = `${viewsLine} L${x(daily.length - 1)},${PAD.top + PLOT_H} L${x(0)},${PAD.top + PLOT_H} Z`;
  const visitorsLine = daily.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.visitors)}`).join(" ");

  return (
    <div>
      <Legend
        items={[
          { color: "var(--brand)", label: "浏览量 PV" },
          { color: "var(--good)", label: "独立访客 UV", dashed: true },
        ]}
      />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="访问趋势">
        <GridLines max={max} />

        <path d={viewsArea} fill="var(--brand)" fillOpacity="0.1" />
        <path
          d={viewsLine}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="2"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={visitorsLine}
          fill="none"
          stroke="var(--good)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* 数据点：超过一个月就不画了，否则密到糊成一条 */}
        {daily.length <= 31 &&
          daily.map((d, i) => (
            <circle key={d.day} cx={x(i)} cy={y(d.views)} r="2.5" fill="var(--brand)" />
          ))}

        {/* 每天一条透明的竖条，只为了挂 <title>：鼠标停在哪天就显示那天的数字 */}
        {daily.map((d, i) => (
          <rect
            key={`hit-${d.day}`}
            x={x(i) - PLOT_W / Math.max(1, daily.length * 2)}
            y={PAD.top}
            width={PLOT_W / Math.max(1, daily.length)}
            height={PLOT_H}
            fill="transparent"
          >
            <title>{`${d.day}　PV ${formatCount(d.views)}　UV ${formatCount(d.visitors)}　登录访客 ${formatCount(d.members)}`}</title>
          </rect>
        ))}

        <XAxisLabels days={daily.map((d) => d.day)} x={x} />
      </svg>
    </div>
  );
}

// ========== 堆叠柱状图（社区增长 / 活动趋势共用） ==========

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

const GROWTH_SERIES: BarSeries[] = [
  { key: "newUsers", label: "新增用户", color: "var(--brand)" },
  { key: "newSubmissions", label: "新增内容", color: "var(--good)" },
  { key: "newComments", label: "新增评论", color: "var(--warn)" },
];

const ACTIVITY_SERIES: BarSeries[] = [
  { key: "checkinUsers", label: "签到人数", color: "var(--brand)" },
  { key: "draws", label: "抽奖次数", color: "var(--warn)" },
];

/**
 * 堆叠柱而不是分组柱：90 天窗口下分组柱只有 2px 宽，什么也看不出来；
 * 堆叠还顺带给出"当天总共发生了多少事"这个更有用的量。
 */
export function StackedBarChart({
  rows,
  series,
  tooltip,
  emptyText,
}: {
  rows: (Record<string, unknown> & { day: string })[];
  series: BarSeries[];
  tooltip: (row: Record<string, unknown>) => string;
  emptyText: string;
}) {
  if (rows.length === 0) return <EmptyState>{emptyText}</EmptyState>;

  const totalOf = (row: Record<string, unknown>) =>
    series.reduce((sum, s) => sum + Math.max(0, Number(row[s.key]) || 0), 0);
  const max = niceMax(Math.max(...rows.map(totalOf), 1));
  const slot = PLOT_W / rows.length;
  const barW = Math.max(1.5, slot * 0.68);

  return (
    <div>
      <Legend items={series.map((s) => ({ color: s.color, label: s.label }))} />
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="堆叠柱状图">
        <GridLines max={max} />

        {rows.map((row, i) => {
          const cx = PAD.left + slot * (i + 0.5);
          let cursor = PAD.top + PLOT_H;

          return (
            <g key={row.day}>
              {series.map((s) => {
                const value = Math.max(0, Number(row[s.key]) || 0);
                if (value <= 0) return null;
                const height = (value / max) * PLOT_H;
                cursor -= height;
                return (
                  <rect
                    key={s.key}
                    x={cx - barW / 2}
                    y={cursor}
                    width={barW}
                    height={height}
                    fill={s.color}
                    rx={barW > 6 ? 1.5 : 0}
                  />
                );
              })}
              {/* 透明覆盖条只为了挂 <title>，让鼠标停在哪天就看到那天的明细 */}
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={PLOT_H} fill="transparent">
                <title>{tooltip(row)}</title>
              </rect>
            </g>
          );
        })}

        <XAxisLabels days={rows.map((row) => row.day)} x={(i) => PAD.left + slot * (i + 0.5)} />
      </svg>
    </div>
  );
}

export function GrowthChart({ daily }: { daily: DailyPoint[] }) {
  return (
    <StackedBarChart
      rows={daily as unknown as (Record<string, unknown> & { day: string })[]}
      series={GROWTH_SERIES}
      emptyText="这段时间还没有数据"
      tooltip={(row) =>
        `${row.day}　用户 +${row.newUsers}　内容 +${row.newSubmissions}　评论 +${row.newComments}`
      }
    />
  );
}

export function ActivityChart({ activity }: { activity: ActivityPoint[] }) {
  return (
    <StackedBarChart
      rows={activity as unknown as (Record<string, unknown> & { day: string })[]}
      series={ACTIVITY_SERIES}
      emptyText="这段时间还没有签到 / 抽奖记录"
      tooltip={(row) =>
        `${row.day}　签到 ${row.checkinUsers} 人　抽奖 ${row.draws} 次　发出经验 ${formatCount(
          Number(row.xpGranted) || 0
        )}`
      }
    />
  );
}

// ========== 活跃时段（24 小时） ==========

export function HourChart({ hourly }: { hourly: HourPoint[] }) {
  const max = Math.max(...hourly.map((h) => h.views), 1);
  if (hourly.every((h) => h.views === 0)) return <EmptyState>这段时间还没有访问数据</EmptyState>;

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 112 }}>
      {hourly.map((h) => (
        <div key={h.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-brand"
            style={{
              // 有数据的小时至少留 2px，否则"1 次访问"和"0 次访问"看起来一样
              height: `${h.views === 0 ? 0 : Math.max(2, (h.views / max) * 88)}px`,
              opacity: 0.35 + 0.65 * (h.views / max),
            }}
            title={`${String(h.hour).padStart(2, "0")}:00　PV ${formatCount(h.views)}　UV ${formatCount(h.visitors)}`}
          />
          {/* 每 3 小时标一个刻度，24 个全标会挤在一起 */}
          <span className="font-mono text-[9px] text-faint">{h.hour % 3 === 0 ? h.hour : ""}</span>
        </div>
      ))}
    </div>
  );
}

// ========== 横向条形榜（热门页面 / 来源 / 设备 / 地区） ==========

export function BarList({
  rows,
  emptyText,
  unit = "次",
}: {
  rows: { label: string; sublabel?: string; href?: string; views: number; visitors: number }[];
  emptyText: string;
  unit?: string;
}) {
  if (rows.length === 0) return <EmptyState>{emptyText}</EmptyState>;
  const max = Math.max(...rows.map((row) => row.views), 1);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink">
              {row.href ? (
                <Link href={row.href} className="hover:text-brand-ink hover:underline">
                  {row.label}
                </Link>
              ) : (
                row.label
              )}
              {row.sublabel && <span className="ml-1.5 font-mono text-[10px] text-faint">{row.sublabel}</span>}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted">
              {formatCount(row.views)}
              {unit}
              <span className="ml-1.5 text-faint">{formatCount(row.visitors)} 人</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.max(1.5, (row.views / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** 来源 / 设备 / 地区都是 BreakdownRow，只有"名字为空时叫什么"不一样。 */
export function breakdownRows(
  rows: BreakdownRow[],
  unknownLabel: string,
  labelFor: (name: string) => string = (name) => name
) {
  return rows.map((row) => ({
    label: row.name ? labelFor(row.name) : unknownLabel,
    views: row.views,
    visitors: row.visitors,
  }));
}

// ========== 转化漏斗 ==========

export interface FunnelStep {
  label: string;
  value: number;
  /** 这一级的说明，例如「浏览器维度，埋点上线后才有」 */
  note?: string;
}

/**
 * 漏斗。每一级的条宽按第一级归一，级间标出转化率。
 * 第一级为 0（埋点刚上线、还没有访客数据）时退化成"只看绝对值"，不显示除零得来的百分比。
 */
export function FunnelBars({ steps }: { steps: FunnelStep[] }) {
  const base = steps[0]?.value ?? 0;

  return (
    <ol className="flex flex-col gap-1">
      {steps.map((step, index) => {
        const prev = index > 0 ? steps[index - 1].value : null;
        const stepRate = prev && prev > 0 ? (step.value / prev) * 100 : null;
        const width = base > 0 ? Math.max(2, (step.value / base) * 100) : step.value > 0 ? 100 : 2;

        return (
          <li key={step.label}>
            {index > 0 && (
              <p className="py-0.5 pl-1 font-mono text-[10px] text-faint">
                ↓ {stepRate === null ? "—" : `${stepRate.toFixed(1)}%`}
              </p>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-ink">
                {step.label}
                {step.note && <span className="ml-1.5 text-[11px] text-faint">{step.note}</span>}
              </span>
              <span className="shrink-0 font-mono text-xs font-semibold text-ink">
                {formatCount(step.value)}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ========== 通用指标榜（等级分布 / 回访 / 奖品 / 经验来源） ==========

export interface MetricRow {
  label: string;
  sublabel?: string;
  value: number;
  /** 右侧的补充说明，例如「回访 58%」「12 人」 */
  note?: string;
  /** 条宽用的值，缺省用 value。负数（抽奖消耗经验）按绝对值画条。 */
  weight?: number;
  color?: string;
}

export function MetricList({
  rows,
  emptyText,
  unit = "",
}: {
  rows: MetricRow[];
  emptyText: string;
  unit?: string;
}) {
  if (rows.length === 0) return <EmptyState>{emptyText}</EmptyState>;
  const max = Math.max(...rows.map((row) => Math.abs(row.weight ?? row.value)), 1);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink">
              {row.label}
              {row.sublabel && <span className="ml-1.5 font-mono text-[10px] text-faint">{row.sublabel}</span>}
            </span>
            <span className="shrink-0 font-mono text-xs text-muted">
              {formatCount(row.value)}
              {unit}
              {row.note && <span className="ml-1.5 text-faint">{row.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(1.5, (Math.abs(row.weight ?? row.value) / max) * 100)}%`,
                background: row.color ?? "var(--brand)",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ========== 分区标题 ==========
// 看板长到七八屏之后，光靠面板标题分不出层次，这条分区线是"往下是另一类问题了"的信号。
export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line pb-2">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ========== 图表内部的小零件 ==========

function Legend({ items }: { items: { color: string; label: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className="inline-block h-[3px] w-4 rounded-full"
            style={{
              background: item.dashed
                ? `repeating-linear-gradient(90deg, ${item.color} 0 4px, transparent 4px 7px)`
                : item.color,
            }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function GridLines({ max }: { max: number }) {
  const ticks = [0, 0.5, 1];
  return (
    <g>
      {ticks.map((ratio) => {
        const y = PAD.top + PLOT_H - ratio * PLOT_H;
        return (
          <g key={ratio}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" className="fill-[var(--faint)] text-[10px]">
              {compact(Math.round(max * ratio))}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XAxisLabels({ days, x }: { days: string[]; x: (index: number) => number }) {
  // 最多 7 个刻度，均匀取样。90 天的图上每天都标日期是没法读的。
  const step = Math.max(1, Math.ceil(days.length / 7));
  return (
    <g>
      {days.map((day, index) => {
        if (index % step !== 0 && index !== days.length - 1) return null;
        // 取样点和最后一天挨太近时跳过，避免两个日期叠在一起
        if (index !== days.length - 1 && days.length - 1 - index < step / 2) return null;
        // 两端的标签改用 start / end 对齐：最后一天的刻度就在绘图区右边界上，
        // 居中对齐会让"10/29"有一半跑到 viewBox 外面被裁掉。
        const cx = x(index);
        const anchor = cx > W - 28 ? "end" : cx < PAD.left + 8 ? "start" : "middle";
        return (
          <text
            key={day}
            x={anchor === "end" ? W : anchor === "start" ? 0 : cx}
            y={H - 8}
            textAnchor={anchor}
            className="fill-[var(--faint)] text-[10px]"
          >
            {shortDay(day)}
          </text>
        );
      })}
    </g>
  );
}

/** 2026-09-03 -> 9/3 */
function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${Number(month)}/${Number(date)}` : day;
}

/** Y 轴上界取整到好读的数：把 137 变成 150，而不是让刻度出现 68.5。 */
function niceMax(value: number): number {
  if (value <= 5) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const factor of [1, 1.5, 2, 3, 5, 7.5, 10]) {
    const candidate = magnitude * factor;
    if (candidate >= value) return candidate;
  }
  return magnitude * 10;
}

function compact(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000)}k`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}
