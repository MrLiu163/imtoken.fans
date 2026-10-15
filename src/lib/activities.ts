import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVITY_TIME_ZONE, WHEEL_SLOTS, type CheckinSettings, type CheckinState, type LotteryPrize, type LotteryPrizeKind, type LotterySettings, type LotteryState, type LotteryWinner, type AdminLotteryDraw } from "@/lib/activity-types";

// 类型和九宫格常量都在 activity-types.ts（客户端组件也要用），这里原样转出去，
// 调用方不用关心某个名字到底来自哪个文件。
export * from "@/lib/activity-types";

// 活动中心（签到 / 抽奖）的读取封装。
//
// 时区：签到和抽奖次数都按 Asia/Shanghai 的自然日算，和数据库函数里的
// `now() at time zone 'Asia/Shanghai'` 保持一致。上海没有夏令时，恒为 UTC+8，
// 所以「当天零点」可以直接拼成 `${date}T00:00:00+08:00`，不需要时区库。

/** 活动时区下的今天，格式 YYYY-MM-DD（en-CA 的默认格式正好是这个） */
export function activityToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 活动时区下今天零点对应的时间戳，用来过滤 created_at */
export function activityDayStartIso(): string {
  return new Date(`${activityToday()}T00:00:00+08:00`).toISOString();
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACTIVITY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// ========== 签到 ==========

const DEFAULT_CHECKIN_SETTINGS: CheckinSettings = {
  enabled: false,
  cycleLength: 7,
  dayRewards: [10, 10, 10, 10, 10, 10, 50],
};

export async function getCheckinSettings(): Promise<CheckinSettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("checkin_settings")
    .select("enabled, cycle_length, day_rewards")
    .eq("id", true)
    .maybeSingle();

  if (!data) return DEFAULT_CHECKIN_SETTINGS;
  return {
    enabled: data.enabled,
    cycleLength: data.cycle_length,
    dayRewards: (data.day_rewards as number[]) ?? [],
  };
}

// 未登录时只返回配置（活动页要能给游客看规则），userId 为空时其余字段是空状态。
export async function getCheckinState(userId: string | null): Promise<CheckinState> {
  const settings = await getCheckinSettings();
  const today = activityToday();

  const empty: CheckinState = {
    settings,
    streak: 0,
    lastCheckinDate: null,
    checkedInToday: false,
    todayDayIndex: 1,
    todayReward: settings.dayRewards[0] ?? 0,
    streakWillReset: false,
    claimedDayIndexes: [],
  };
  if (!userId) return empty;

  const supabase = await createClient();
  const [{ data: profile }, { data: recent }] = await Promise.all([
    supabase.from("profiles").select("checkin_streak, last_checkin_date").eq("id", userId).maybeSingle(),
    // 只需要覆盖当前周期，多取几天做缓冲（周期最长 31 天）。
    supabase
      .from("checkins")
      .select("checkin_date, day_index")
      .eq("user_id", userId)
      .gte("checkin_date", addDays(today, -(settings.cycleLength + 1)))
      .order("checkin_date", { ascending: false }),
  ]);

  if (!profile) return empty;

  const streak = profile.checkin_streak ?? 0;
  const lastDate: string | null = profile.last_checkin_date ?? null;
  const checkedInToday = lastDate === today;
  const yesterday = addDays(today, -1);
  // 昨天签过 -> 连上；否则从第 1 天重新开始。和 perform_checkin() 里的判断一致。
  const nextStreak = checkedInToday ? streak : lastDate === yesterday ? streak + 1 : 1;
  const dayIndex = ((nextStreak - 1) % settings.cycleLength) + 1;

  // 点亮格子：本周期里已经领过的那几天。
  // streak 是连续天数，所以「最后一次签到落在周期的第几天」能直接反推出本周期的起始日；
  // 一旦断签（最后一次签到既不是今天也不是昨天），上个周期的记录就不该再点亮了。
  let claimedDayIndexes: number[] = [];
  if (lastDate && (checkedInToday || lastDate === yesterday)) {
    const lastDayIndex = ((streak - 1) % settings.cycleLength) + 1;
    const cycleStart = addDays(lastDate, -(lastDayIndex - 1));
    claimedDayIndexes = (recent ?? [])
      .filter((row) => row.checkin_date >= cycleStart && row.checkin_date <= lastDate)
      .map((row) => row.day_index as number);
  }

  return {
    settings,
    streak,
    lastCheckinDate: lastDate,
    checkedInToday,
    todayDayIndex: dayIndex,
    todayReward: settings.dayRewards[dayIndex - 1] ?? 0,
    streakWillReset: !checkedInToday && lastDate !== null && lastDate !== yesterday,
    claimedDayIndexes,
  };
}

// ========== 抽奖 ==========

const DEFAULT_LOTTERY_SETTINGS: LotterySettings = {
  enabled: false,
  costTickets: 1,
  startsAt: null,
  endsAt: null,
  drawsPerDay: 0,
  costXp: 0,
};

function mapPrize(row: Record<string, unknown>): LotteryPrize {
  return {
    id: row.id as string,
    position: row.position as number,
    name: row.name as string,
    icon: row.icon as string,
    kind: row.kind as LotteryPrizeKind,
    xpAmount: (row.xp_amount as number) ?? 0,
    ticketAmount: (row.ticket_amount as number) ?? 0,
    badgeKey: (row.badge_key as string | null) ?? null,
    weight: (row.weight as number) ?? 0,
    stock: (row.stock as number | null) ?? null,
    awardedCount: (row.awarded_count as number) ?? 0,
    isThanks: Boolean(row.is_thanks),
    active: Boolean(row.active),
  };
}

const PRIZE_COLUMNS =
  "id, position, name, icon, kind, xp_amount, ticket_amount, badge_key, weight, stock, awarded_count, is_thanks, active";

// 前台用：只要 active 的奖品，并且保证 8 个奖位都有东西可渲染
// （后台把某个奖位停用了，格子也不能空着，不然九宫格会缺一块）。
export async function getLotteryPrizes(): Promise<LotteryPrize[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("lottery_prizes").select(PRIZE_COLUMNS).order("position");
  const byPosition = new Map((data ?? []).map((row) => [row.position as number, mapPrize(row)]));

  return Array.from({ length: WHEEL_SLOTS }, (_, position) => {
    const prize = byPosition.get(position);
    if (prize && prize.active) return prize;
    return {
      id: `placeholder-${position}`,
      position,
      // 占位奖位没有名字：文案是"敬请期待 / Coming soon"这种界面文案，
      // 归 messages/*.json 管（lottery.emptySlot），不在数据层写死中文。
      name: "",
      icon: "❔",
      kind: "none" as LotteryPrizeKind,
      xpAmount: 0,
      ticketAmount: 0,
      badgeKey: null,
      weight: 0,
      stock: null,
      awardedCount: 0,
      isThanks: false,
      active: false,
    };
  });
}

// 后台用：原样返回所有奖位（含停用的），不做占位补齐。
export async function getLotteryPrizesForAdmin(): Promise<LotteryPrize[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("lottery_prizes").select(PRIZE_COLUMNS).order("position");
  return (data ?? []).map(mapPrize);
}

export async function getLotterySettings(): Promise<LotterySettings> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lottery_settings")
    .select("enabled, cost_tickets, starts_at, ends_at, draws_per_day, cost_xp")
    .eq("id", true)
    .maybeSingle();

  if (!data) return DEFAULT_LOTTERY_SETTINGS;
  return {
    enabled: data.enabled,
    costTickets: data.cost_tickets,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    drawsPerDay: data.draws_per_day,
    costXp: data.cost_xp,
  };
}

export async function getLotteryState(userId: string | null): Promise<LotteryState> {
  const supabase = await createClient();
  const [settings, prizes, { data: winnerRows }] = await Promise.all([
    getLotterySettings(),
    getLotteryPrizes(),
    // 「最近有人中了什么」——中奖记录是公开可读的（RLS: select using (true)），
    // 这条滚动播报是抽奖最能带动参与感的部分。
    supabase
      .from("lottery_draws")
      .select("id, prize_name, prize_icon, created_at, profiles!lottery_draws_user_id_fkey(username, display_name, level)")
      .neq("prize_kind", "none")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  // 没设每日上限（draws_per_day = 0）时不需要查今天抽了几次——门槛完全由券决定。
  let drawsLeft: number | null = settings.drawsPerDay > 0 ? settings.drawsPerDay : null;
  let tickets = 0;
  if (userId) {
    const [{ data: profile }, drawCount] = await Promise.all([
      supabase.from("profiles").select("lottery_tickets").eq("id", userId).maybeSingle(),
      settings.drawsPerDay > 0
        ? supabase
            .from("lottery_draws")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("created_at", activityDayStartIso())
        : Promise.resolve({ count: 0 }),
    ]);
    tickets = profile?.lottery_tickets ?? 0;
    if (settings.drawsPerDay > 0) {
      drawsLeft = Math.max(0, settings.drawsPerDay - (drawCount.count ?? 0));
    }
  }

  const recentWinners: LotteryWinner[] = (winnerRows ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      username: string | null;
      display_name: string | null;
      level: number | null;
    } | null;
    return {
      id: row.id as string,
      prizeName: row.prize_name as string,
      prizeIcon: row.prize_icon as string,
      createdAt: row.created_at as string,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      level: profile?.level ?? 0,
    };
  });

  return { settings, prizes, tickets, drawsLeft, recentWinners };
}

// ========== 后台：中奖记录 ==========

export async function getLotteryDrawsForAdmin(limit = 50): Promise<AdminLotteryDraw[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("lottery_draws")
    .select(
      "id, user_id, prize_name, prize_icon, prize_kind, xp_awarded, tickets_awarded, fulfilled_at, created_at, profiles!lottery_draws_user_id_fkey(username, display_name)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { username: string | null; display_name: string | null } | null;
    return {
      id: row.id as string,
      userId: row.user_id as string,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      prizeName: row.prize_name as string,
      prizeIcon: row.prize_icon as string,
      prizeKind: row.prize_kind as LotteryPrizeKind,
      xpAwarded: (row.xp_awarded as number) ?? 0,
      ticketsAwarded: (row.tickets_awarded as number) ?? 0,
      fulfilledAt: (row.fulfilled_at as string | null) ?? null,
      createdAt: row.created_at as string,
    };
  });
}
