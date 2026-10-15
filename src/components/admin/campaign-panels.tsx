"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  grantLotteryTicketsByUsername,
  resetLotteryPrizeStock,
  setLotteryDrawFulfilled,
  updateCheckinSettings,
  updateLotteryPrize,
  updateLotterySettings,
  updateXpRule,
  type PrizeInput,
} from "@/app/admin/campaign-actions";
import { XP_ACTION_INFO } from "@/lib/level";
import type { XpRule } from "@/lib/xp";
import type {
  AdminLotteryDraw,
  CheckinSettings,
  LotteryPrize,
  LotteryPrizeKind,
  LotterySettings,
} from "@/lib/activity-types";
import { BADGE_INFO, GRANTABLE_BADGE_KEYS } from "@/lib/types";
import { EmptyState, TimeAgo } from "@/components/admin/ui";

// 活动管理的各个面板。都是「本地编辑 + 显式保存」而不是逐项乐观更新：
// 这几张表单是一组相互关联的数值（比如 7 天的奖励要一起看），
// 改一个数字就立刻写库反而容易存进半成品配置。

// ========== 抽奖券发放 ==========
// 券是抽奖唯一的门槛，而它只能人工发（或从九宫格里抽到，但那要先有券）。
// 用户管理页每一行里也有同样的入口，这里再放一个是因为运营找"发券"多半先来活动管理页，
// 而且这里支持直接敲用户名，不用先把人搜出来。
export function TicketGrantPanel() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [amount, setAmount] = useState(5);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function run(delta: number) {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await grantLotteryTicketsByUsername(username, delta);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDone(
        `${delta > 0 ? "已发放" : "已收回"} ${Math.abs(delta)} 张 · ${result.displayName} 现在有 ${result.newBalance} 张`
      );
      setUsername("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink">发放抽奖券</p>
      <p className="mt-0.5 text-xs text-muted">
        抽奖是纯券制，没券的用户点不动抽奖按钮。新站上线时要先从这里发一批，否则谁都抽不了。
        用户管理页每个用户那一行里也有同样的入口。
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="用户名" hint="@提及用的那个用户名，不是昵称">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="hongbo_liu"
            className="w-48 rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-sm text-ink"
          />
        </Field>
        <Field label="数量">
          <NumberInput value={amount} onChange={setAmount} min={1} max={10000} />
        </Field>
        <button
          type="button"
          disabled={isPending || !username.trim() || amount <= 0}
          onClick={() => run(Math.abs(amount))}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-40"
        >
          发放
        </button>
        <button
          type="button"
          disabled={isPending || !username.trim() || amount <= 0}
          onClick={() => run(-Math.abs(amount))}
          className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-risk hover:text-risk disabled:opacity-40"
        >
          收回
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-risk">{error}</p>}
      {done && <p className="mt-3 text-xs text-good">{done}</p>}
    </div>
  );
}

// ========== 共用小控件 ==========

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max = 100000,
  className = "",
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(event) => onChange(Number(event.target.value))}
      className={`w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink ${className}`}
    />
  );
}

function Toggle({
  on,
  onChange,
  onLabel = "已开启",
  offLabel = "已关闭",
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  onLabel?: string;
  offLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        on ? "bg-good text-white" : "border border-line text-muted hover:border-brand hover:text-brand-ink"
      }`}
    >
      {on ? onLabel : offLabel}
    </button>
  );
}

function SaveBar({
  dirty,
  isPending,
  error,
  saved,
  onSave,
  onReset,
  extra,
}: {
  dirty: boolean;
  isPending: boolean;
  error: string | null;
  saved: boolean;
  onSave: () => void;
  onReset: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!dirty || isPending}
        onClick={onSave}
        className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? "保存中…" : "保存"}
      </button>
      {dirty && !isPending && (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          放弃修改
        </button>
      )}
      {extra}
      {saved && !dirty && <span className="text-xs font-medium text-good">已保存</span>}
      {error && <span className="text-xs text-risk">{error}</span>}
    </div>
  );
}

// 所有面板的保存流程都一样：改 -> 存 -> 成功给个"已保存" -> router.refresh() 拉最新数据。
function useSaver() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function save(task: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await task();
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onSuccess?.();
      router.refresh();
    });
  }

  return { isPending, error, saved, save };
}

// ========== 签到设置 ==========

export function CheckinSettingsPanel({ settings }: { settings: CheckinSettings }) {
  const { isPending, error, saved, save } = useSaver();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [cycleLength, setCycleLength] = useState(settings.cycleLength);
  const [rewards, setRewards] = useState<number[]>(settings.dayRewards);

  const dirty =
    enabled !== settings.enabled ||
    cycleLength !== settings.cycleLength ||
    rewards.slice(0, cycleLength).join(",") !== settings.dayRewards.slice(0, settings.cycleLength).join(",");

  function reset() {
    setEnabled(settings.enabled);
    setCycleLength(settings.cycleLength);
    setRewards(settings.dayRewards);
  }

  function setReward(index: number, value: number) {
    setRewards((prev) => {
      const next = [...prev];
      // 周期改长时数组会有空洞，用 0 填上，保存时后端也会再补一遍。
      for (let i = 0; i < cycleLength; i += 1) if (next[i] === undefined) next[i] = 0;
      next[index] = value;
      return next;
    });
  }

  const total = rewards.slice(0, cycleLength).reduce((sum, value) => sum + (value || 0), 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">每日签到</p>
          <p className="mt-0.5 text-xs text-muted">
            连续签到 {cycleLength} 天为一个周期，走完自动回到第 1 天；断签一天则重新从第 1 天开始。
            「一天」按北京时间（UTC+8）算。
          </p>
        </div>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>

      <div className="mt-4 grid max-w-xs grid-cols-1 gap-3">
        <Field label="周期天数" hint="1-31 天">
          <NumberInput value={cycleLength} onChange={(v) => setCycleLength(Math.min(31, Math.max(1, v)))} min={1} max={31} />
        </Field>
      </div>

      <div className="mt-4">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-faint">每天的经验值奖励</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-7">
          {Array.from({ length: cycleLength }, (_, i) => (
            <label key={i} className="flex flex-col gap-1">
              <span className="text-center text-[11px] text-muted">第 {i + 1} 天</span>
              <NumberInput value={rewards[i] ?? 0} onChange={(v) => setReward(i, v)} className="text-center" />
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          走完一个完整周期共 <span className="font-mono font-semibold text-ink">{total}</span> 点经验值
        </p>
      </div>

      <SaveBar
        dirty={dirty}
        isPending={isPending}
        error={error}
        saved={saved}
        onSave={() => save(() => updateCheckinSettings({ enabled, cycleLength, dayRewards: rewards }))}
        onReset={reset}
      />
    </div>
  );
}

// ========== 经验值规则 ==========

export function XpRulesPanel({ rules }: { rules: XpRule[] }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink">社区行为经验值</p>
      <p className="mt-0.5 text-xs text-muted">
        论坛里的互动行为各自值多少经验，以及每天最多计分几次（0 = 不限）。
        每日上限是防刷分的关键——评论默认不走审核，没有上限等于无门槛送经验。
        改动即时生效，不用重新部署。
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {rules.map((rule) => (
          <XpRuleRow key={rule.action_key} rule={rule} />
        ))}
      </div>

      <p className="mt-3 text-[11px] text-faint">
        签到奖励在上面的「每日签到」里配，抽奖奖品的经验在下面的「抽奖奖品」里配，都不在这张表。
      </p>
    </div>
  );
}

function XpRuleRow({ rule }: { rule: XpRule }) {
  const { isPending, error, saved, save } = useSaver();
  const [amount, setAmount] = useState(rule.amount);
  const [dailyCap, setDailyCap] = useState(rule.daily_cap);
  const [enabled, setEnabled] = useState(rule.enabled);

  const info = XP_ACTION_INFO[rule.action_key];
  const dirty = amount !== rule.amount || dailyCap !== rule.daily_cap || enabled !== rule.enabled;

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{info.label}</p>
          <p className="text-xs text-muted">{info.description}</p>
        </div>

        <div className="flex shrink-0 flex-wrap items-end gap-2">
          <div className="w-24">
            <Field label="经验值">
              <NumberInput value={amount} onChange={setAmount} />
            </Field>
          </div>
          <div className="w-24">
            <Field label="每日上限">
              <NumberInput value={dailyCap} onChange={setDailyCap} max={1000} />
            </Field>
          </div>
          <Toggle on={enabled} onChange={setEnabled} onLabel="生效中" offLabel="已停用" />
          <button
            type="button"
            disabled={!dirty || isPending}
            onClick={() => save(() => updateXpRule(rule.action_key, { amount, dailyCap, enabled }))}
            className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? "…" : "保存"}
          </button>
        </div>
      </div>

      {(error || (saved && !dirty)) && (
        <p className={`mt-1.5 text-xs ${error ? "text-risk" : "text-good"}`}>{error ?? "已保存"}</p>
      )}
    </div>
  );
}

// ========== 抽奖设置 ==========

// <input type="datetime-local"> 认的是 "YYYY-MM-DDTHH:mm"（浏览器本地时区），
// 数据库里存的是 timestamptz。两边来回转一下，运营填的就是自己看到的时间。
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function LotterySettingsPanel({ settings }: { settings: LotterySettings }) {
  const { isPending, error, saved, save } = useSaver();
  const [enabled, setEnabled] = useState(settings.enabled);
  const [costTickets, setCostTickets] = useState(settings.costTickets);
  const [startsAt, setStartsAt] = useState(toLocalInput(settings.startsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(settings.endsAt));
  const [drawsPerDay, setDrawsPerDay] = useState(settings.drawsPerDay);
  const [costXp, setCostXp] = useState(settings.costXp);

  const dirty =
    enabled !== settings.enabled ||
    costTickets !== settings.costTickets ||
    startsAt !== toLocalInput(settings.startsAt) ||
    endsAt !== toLocalInput(settings.endsAt) ||
    drawsPerDay !== settings.drawsPerDay ||
    costXp !== settings.costXp;

  function reset() {
    setEnabled(settings.enabled);
    setCostTickets(settings.costTickets);
    setStartsAt(toLocalInput(settings.startsAt));
    setEndsAt(toLocalInput(settings.endsAt));
    setDrawsPerDay(settings.drawsPerDay);
    setCostXp(settings.costXp);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">抽奖设置</p>
          <p className="mt-0.5 text-xs text-muted">
            抽奖是纯券制：用户手里没券就点不动抽奖按钮，券数量显示在按钮下面。
            活动时间之外同样抽不了（时间判定在数据库里做，改客户端时钟没用）。
          </p>
        </div>
        <Toggle on={enabled} onChange={setEnabled} />
      </div>

      <div className="mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="每次消耗券" hint="1-10 张">
          <NumberInput value={costTickets} onChange={setCostTickets} min={1} max={10} />
        </Field>
        <Field label="每次消耗经验" hint="0 = 只花券">
          <NumberInput value={costXp} onChange={setCostXp} />
        </Field>
        <Field label="每日次数上限" hint="0 = 不限，只看券">
          <NumberInput value={drawsPerDay} onChange={setDrawsPerDay} max={1000} />
        </Field>
      </div>

      <div className="mt-3 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="活动开始时间" hint="留空 = 立即开放">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </Field>
        <Field label="活动结束时间" hint="留空 = 不结束">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
          />
        </Field>
      </div>

      <SaveBar
        dirty={dirty}
        isPending={isPending}
        error={error}
        saved={saved}
        onSave={() =>
          save(() =>
            updateLotterySettings({
              enabled,
              costTickets,
              startsAt: fromLocalInput(startsAt),
              endsAt: fromLocalInput(endsAt),
              drawsPerDay,
              costXp,
            })
          )
        }
        onReset={reset}
      />

      <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">
        ⚠️ 抽奖券只有两个来源：这里下面「奖品」里的抽奖券奖位，和用户管理页的人工发放。
        新用户手里是 0 张券，所以<span className="font-semibold">冷启动要先在用户管理页发一批券</span>，
        否则没人抽得动。
      </p>
    </div>
  );
}

// ========== 抽奖奖品 ==========

const KIND_LABEL: Record<LotteryPrizeKind, string> = {
  xp: "经验值",
  ticket: "抽奖券（再来一次）",
  badge: "徽章",
  item: "实物 / 线下奖品",
  none: "谢谢参与（无奖）",
};

// 九宫格外圈的位置示意，让运营知道 0-7 分别在格子的哪儿。
const POSITION_LABEL = ["左上", "上", "右上", "右", "右下", "下", "左下", "左"];

export function LotteryPrizesPanel({ prizes }: { prizes: LotteryPrize[] }) {
  const drawable = prizes.filter(
    (prize) => prize.active && prize.weight > 0 && (prize.stock === null || prize.awardedCount < prize.stock)
  );
  const totalWeight = drawable.reduce((sum, prize) => sum + prize.weight, 0);
  // 兜底奖位必须存在：限量奖品全抽完之后没有不限量的奖位可发，抽奖会直接报错。
  const hasThanks = prizes.some((prize) => prize.active && prize.isThanks && prize.stock === null);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p className="font-semibold text-ink">抽奖奖品（九宫格外圈 8 个奖位）</p>
      <p className="mt-0.5 text-xs text-muted">
        中奖概率 = 该奖品权重 ÷ 所有可抽奖品的权重之和，某个限量奖品抽完后概率自动分摊给其余奖品。
        获奖人数上限就是「限量份数」，抽完即止。
      </p>

      {!hasThanks && (
        <p className="mt-3 rounded-xl bg-risk-soft px-3 py-2 text-xs font-medium text-risk">
          ⚠️ 当前没有启用中的「兜底奖位」。限量奖品全部抽完后会没有奖可发，抽奖将不可用——
          请把其中一格设成「谢谢参与」并勾上「兜底奖位」。
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {prizes.map((prize) => (
          <PrizeRow key={prize.position} prize={prize} totalWeight={totalWeight} />
        ))}
      </div>
    </div>
  );
}

function PrizeRow({ prize, totalWeight }: { prize: LotteryPrize; totalWeight: number }) {
  const { isPending, error, saved, save } = useSaver();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<PrizeInput>({
    name: prize.name,
    icon: prize.icon,
    kind: prize.kind,
    xpAmount: prize.xpAmount,
    ticketAmount: prize.ticketAmount,
    badgeKey: prize.badgeKey,
    weight: prize.weight,
    stock: prize.stock,
    isThanks: prize.isThanks,
    active: prize.active,
  });

  const soldOut = prize.stock !== null && prize.awardedCount >= prize.stock;
  const chance =
    totalWeight > 0 && prize.active && prize.weight > 0 && !soldOut
      ? (prize.weight / totalWeight) * 100
      : 0;

  const dirty =
    form.name !== prize.name ||
    form.icon !== prize.icon ||
    form.kind !== prize.kind ||
    form.xpAmount !== prize.xpAmount ||
    form.ticketAmount !== prize.ticketAmount ||
    form.badgeKey !== prize.badgeKey ||
    form.weight !== prize.weight ||
    form.stock !== prize.stock ||
    form.isThanks !== prize.isThanks ||
    form.active !== prize.active;

  function patch(next: Partial<PrizeInput>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="font-mono text-[10px] text-faint">#{prize.position}</span>
          <span className="text-xl leading-none" aria-hidden>
            {form.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {form.name}
              {prize.isThanks && (
                <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 py-0.5 font-mono text-[9px] text-brand-ink">
                  兜底
                </span>
              )}
              {!prize.active && (
                <span className="ml-1.5 rounded-full bg-surface px-1.5 py-0.5 font-mono text-[9px] text-faint">
                  已停用
                </span>
              )}
            </p>
            <p className="font-mono text-[11px] text-faint">
              {POSITION_LABEL[prize.position]} · {KIND_LABEL[prize.kind]} ·{" "}
              {prize.stock === null
                ? "不限量"
                : soldOut
                  ? `限量 ${prize.stock} · 已抽完`
                  : `限量 ${prize.stock} · 已送出 ${prize.awardedCount}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-surface px-2.5 py-1 font-mono text-xs font-bold text-brand-ink">
            {chance > 0 ? `${chance.toFixed(1)}%` : "—"}
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
          >
            {expanded ? "收起" : "编辑"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="图标" hint="1 个 emoji">
              <input
                value={form.icon}
                maxLength={4}
                onChange={(event) => patch({ icon: event.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-center text-sm"
              />
            </Field>
            <Field label="奖品名称">
              <input
                value={form.name}
                maxLength={20}
                onChange={(event) => patch({ name: event.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              />
            </Field>
            <Field label="奖品类型">
              <select
                value={form.kind}
                onChange={(event) => patch({ kind: event.target.value as LotteryPrizeKind })}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
              >
                {(Object.keys(KIND_LABEL) as LotteryPrizeKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="概率权重" hint="相对值，不是百分比">
              <NumberInput value={form.weight} onChange={(v) => patch({ weight: v })} />
            </Field>

            {form.kind === "xp" && (
              <Field label="奖励经验值">
                <NumberInput value={form.xpAmount} onChange={(v) => patch({ xpAmount: v })} />
              </Field>
            )}

            {form.kind === "ticket" && (
              <Field label="奖励抽奖券" hint="抽中相当于再来一次">
                <NumberInput
                  value={form.ticketAmount}
                  onChange={(v) => patch({ ticketAmount: v })}
                  min={1}
                  max={100}
                />
              </Field>
            )}

            {form.kind === "badge" && (
              <Field label="徽章">
                <select
                  value={form.badgeKey ?? ""}
                  onChange={(event) => patch({ badgeKey: event.target.value || null })}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
                >
                  <option value="">选择徽章…</option>
                  {GRANTABLE_BADGE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {BADGE_INFO[key].icon} {BADGE_INFO[key].name}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="获奖人数上限" hint={form.isThanks ? "兜底奖位强制不限量" : "留空 = 不限量"}>
              <div className="flex items-center gap-2">
                <NumberInput
                  value={form.stock ?? 0}
                  onChange={(v) => patch({ stock: v })}
                  max={1_000_000}
                  className={form.stock === null || form.isThanks ? "opacity-40" : ""}
                />
                <button
                  type="button"
                  disabled={form.isThanks}
                  onClick={() => patch({ stock: form.stock === null ? 100 : null })}
                  className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink disabled:opacity-40"
                >
                  {form.stock === null ? "改为限量" : "不限量"}
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Toggle
              on={form.active}
              onChange={(active) => patch({ active })}
              onLabel="在九宫格中显示"
              offLabel="已停用（格子显示为「敬请期待」）"
            />
            <button
              type="button"
              onClick={() => patch({ isThanks: !form.isThanks, stock: !form.isThanks ? null : form.stock })}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                form.isThanks
                  ? "bg-brand text-white"
                  : "border border-line text-muted hover:border-brand hover:text-brand-ink"
              }`}
            >
              兜底奖位
            </button>
          </div>

          <SaveBar
            dirty={dirty}
            isPending={isPending}
            error={error}
            saved={saved}
            onSave={() => save(() => updateLotteryPrize(prize.position, form))}
            onReset={() =>
              setForm({
                name: prize.name,
                icon: prize.icon,
                kind: prize.kind,
                xpAmount: prize.xpAmount,
                ticketAmount: prize.ticketAmount,
                badgeKey: prize.badgeKey,
                weight: prize.weight,
                stock: prize.stock,
                isThanks: prize.isThanks,
                active: prize.active,
              })
            }
            extra={
              prize.awardedCount > 0 ? (
                <RestockButton position={prize.position} awardedCount={prize.awardedCount} />
              ) : null
            }
          />
        </div>
      )}
    </div>
  );
}

function RestockButton({ position, awardedCount }: { position: number; awardedCount: number }) {
  const { isPending, save } = useSaver();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`把这个奖位的「已送出 ${awardedCount} 份」清零？中奖记录不会被删除。`)) return;
        save(() => resetLotteryPrizeStock(position));
      }}
      className="rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-warn hover:text-warn disabled:opacity-40"
    >
      补货（已送出清零）
    </button>
  );
}

// ========== 中奖记录 ==========

export function LotteryDrawsPanel({ draws }: { draws: AdminLotteryDraw[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fulfilled, setFulfilled] = useState<Record<string, boolean>>({});

  if (draws.length === 0) return <EmptyState>还没有人抽过奖。</EmptyState>;

  function toggle(draw: AdminLotteryDraw) {
    const next = !(fulfilled[draw.id] ?? Boolean(draw.fulfilledAt));
    setFulfilled((prev) => ({ ...prev, [draw.id]: next }));
    startTransition(async () => {
      const result = await setLotteryDrawFulfilled(draw.id, next);
      if (result.error) {
        setFulfilled((prev) => ({ ...prev, [draw.id]: !next }));
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      {draws.map((draw) => {
        const isFulfilled = fulfilled[draw.id] ?? Boolean(draw.fulfilledAt);
        return (
          <div key={draw.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-lg leading-none" aria-hidden>
                {draw.prizeIcon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  <span className="font-semibold">{draw.displayName || draw.username || "已注销用户"}</span>
                  {" 抽中 "}
                  <span className="font-semibold">{draw.prizeName}</span>
                  {draw.xpAwarded > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-good">+{draw.xpAwarded} XP</span>
                  )}
                  {draw.ticketsAwarded > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-warn">+{draw.ticketsAwarded} 🎟️</span>
                  )}
                </p>
                <TimeAgo iso={draw.createdAt} className="font-mono text-[11px] text-faint" />
              </div>
            </div>

            {/* 只有实物奖品需要人工发放；经验和徽章在抽中的那一刻就已经到账了。 */}
            {draw.prizeKind === "item" ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => toggle(draw)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  isFulfilled
                    ? "bg-good text-white"
                    : "border border-line text-muted hover:border-brand hover:text-brand-ink"
                }`}
              >
                {isFulfilled ? "已发放" : "标记已发放"}
              </button>
            ) : (
              <span className="shrink-0 font-mono text-[11px] text-faint">自动到账</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
