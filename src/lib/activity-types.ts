// 活动中心的纯类型与常量。单独一个文件是因为客户端组件（九宫格）需要 import
// 九宫格的格子顺序常量；而 activities.ts 带 "server-only"（里面要用 admin client），
// 客户端一 import 就会在构建时报错。
//
// 这里只放不依赖任何服务端能力的东西，读取逻辑仍然全在 activities.ts。

export const ACTIVITY_TIME_ZONE = "Asia/Shanghai";

/** 九宫格 3×3 的格子下标（0..8），外圈按顺时针排列，中间那格（4）是抽奖按钮 */
export const WHEEL_RING_CELLS = [0, 1, 2, 5, 8, 7, 6, 3] as const;
export const WHEEL_SLOTS = WHEEL_RING_CELLS.length;

// ========== 签到 ==========

export interface CheckinSettings {
  enabled: boolean;
  cycleLength: number;
  /** 第 N 天的经验奖励，下标 0 = 第 1 天。签到只发经验，不发抽奖券 */
  dayRewards: number[];
}

export interface CheckinState {
  settings: CheckinSettings;
  /** 已连续签到天数（不因周期结束清零） */
  streak: number;
  lastCheckinDate: string | null;
  checkedInToday: boolean;
  /** 今天签到会落在周期里的第几天（1..cycleLength） */
  todayDayIndex: number;
  /** 今天签到能拿多少经验 */
  todayReward: number;
  /** 断签提示：昨天没签、且今天还没签，说明连续天数会从头开始 */
  streakWillReset: boolean;
  /** 本周期内已经签到的天序号（1..cycleLength），用来点亮格子 */
  claimedDayIndexes: number[];
}

// ========== 抽奖 ==========

export type LotteryPrizeKind = "xp" | "badge" | "item" | "ticket" | "none";

export interface LotteryPrize {
  id: string;
  position: number;
  name: string;
  icon: string;
  kind: LotteryPrizeKind;
  xpAmount: number;
  /** kind = "ticket" 时奖励几张抽奖券（相当于"再来一次"那类玩法） */
  ticketAmount: number;
  badgeKey: string | null;
  weight: number;
  /** null = 不限量 */
  stock: number | null;
  awardedCount: number;
  /** 兜底奖位：限量奖品全抽完时发这个，必须不限量 */
  isThanks: boolean;
  active: boolean;
}

export interface LotterySettings {
  enabled: boolean;
  /** 每次抽奖消耗几张券。没券就抽不了，这是唯一的门槛 */
  costTickets: number;
  /** 活动开始时间（ISO），null = 不限制开始 */
  startsAt: string | null;
  /** 活动结束时间（ISO），null = 不限制结束 */
  endsAt: string | null;
  /** 每天最多抽几次的可选上限，0 = 不限（只受券约束） */
  drawsPerDay: number;
  /** 每次抽奖额外消耗的经验值，0 = 不额外消耗 */
  costXp: number;
}

/** 活动时间窗口的当前状态，前后端都按这个判断按钮能不能点 */
export type LotteryWindowStatus = "open" | "not_started" | "ended" | "disabled";

export function lotteryWindowStatus(settings: LotterySettings, now: number = Date.now()): LotteryWindowStatus {
  if (!settings.enabled) return "disabled";
  if (settings.startsAt && now < new Date(settings.startsAt).getTime()) return "not_started";
  if (settings.endsAt && now >= new Date(settings.endsAt).getTime()) return "ended";
  return "open";
}

export interface LotteryWinner {
  id: string;
  prizeName: string;
  prizeIcon: string;
  createdAt: string;
  username: string | null;
  displayName: string | null;
  level: number;
}

export interface LotteryState {
  settings: LotterySettings;
  /** 九宫格外圈 8 个奖位，按 position 排好序（缺位用占位奖品补齐） */
  prizes: LotteryPrize[];
  /** 当前用户手里的抽奖券 */
  tickets: number;
  /** 今天还能抽几次；null = 没设每日上限，只看券够不够 */
  drawsLeft: number | null;
  recentWinners: LotteryWinner[];
}

export interface AdminLotteryDraw {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  prizeName: string;
  prizeIcon: string;
  prizeKind: LotteryPrizeKind;
  xpAwarded: number;
  ticketsAwarded: number;
  fulfilledAt: string | null;
  createdAt: string;
}
