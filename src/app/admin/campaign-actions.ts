"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/admin-guard";
import { adjustXp } from "@/lib/xp";
import { notifyTicketChange, notifyXpAdjusted } from "@/lib/notify";
import { LEVEL_THRESHOLDS, MAX_LEVEL, XP_ACTION_KEYS, type XpActionKey } from "@/lib/level";
import type { LotteryPrizeKind } from "@/lib/activities";

// 活动管理（签到规则 / 抽奖奖品 / 经验值规则 / 手动补经验）的 Server Actions。
// 单独一个文件是因为 admin/actions.ts 已经很长了，而这一组的调用方只有活动管理页。
//
// 权限：一律 manage_campaigns。Admin 天生有全部权限，Manager 要被单独授予。
// 页面级的 requireAdmin 挡不住直接 POST 到 Server Action，所以每个 action 内部都要查。

const CAMPAIGN_PATHS = ["/admin", "/admin/campaigns", "/activities"];

function revalidateCampaigns(): void {
  for (const path of CAMPAIGN_PATHS) revalidatePath(path);
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

// ========== 经验值规则 ==========

export async function updateXpRule(
  actionKey: string,
  input: { amount: number; dailyCap: number; enabled: boolean }
): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  // 只允许改代码认识的那几个 key：xp_rules 的 action_key 是和 award_xp_by_rule 对应的契约，
  // 凭空写一个新 key 进去不会有任何代码去触发它，只会让后台显示一条永远不生效的规则。
  if (!XP_ACTION_KEYS.includes(actionKey as XpActionKey)) {
    return { error: "未知的经验值规则" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("xp_rules")
    .update({
      amount: clampInt(input.amount, 0, 100_000),
      daily_cap: clampInt(input.dailyCap, 0, 1000),
      enabled: input.enabled,
      updated_at: new Date().toISOString(),
      updated_by: guard.profile.id,
    })
    .eq("action_key", actionKey);

  if (error) return { error: error.message };
  revalidateCampaigns();
  return {};
}

// ========== 签到设置 ==========

export async function updateCheckinSettings(input: {
  enabled: boolean;
  cycleLength: number;
  dayRewards: number[];
}): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const cycleLength = clampInt(input.cycleLength, 1, 31);
  // 数组长度必须正好等于周期天数：perform_checkin 用 day_rewards[day] 取奖励，
  // 少了会取到 null（当 0 分发），多了那几天永远取不到。
  const dayRewards = Array.from({ length: cycleLength }, (_, i) =>
    clampInt(input.dayRewards[i] ?? 0, 0, 100_000)
  );

  const admin = createAdminClient();
  const { error } = await admin
    .from("checkin_settings")
    .update({
      enabled: input.enabled,
      cycle_length: cycleLength,
      day_rewards: dayRewards,
      updated_at: new Date().toISOString(),
      updated_by: guard.profile.id,
    })
    .eq("id", true);

  if (error) return { error: error.message };
  revalidateCampaigns();
  return {};
}

// ========== 抽奖设置 ==========

export async function updateLotterySettings(input: {
  enabled: boolean;
  costTickets: number;
  /** ISO 字符串，空 = 不限制 */
  startsAt: string | null;
  endsAt: string | null;
  drawsPerDay: number;
  costXp: number;
}): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const startsAt = input.startsAt?.trim() ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt?.trim() ? new Date(input.endsAt) : null;
  if (startsAt && Number.isNaN(startsAt.getTime())) return { error: "开始时间格式不对" };
  if (endsAt && Number.isNaN(endsAt.getTime())) return { error: "结束时间格式不对" };
  // 数据库上也有同样的 check 约束，这里先挡一次是为了给个中文报错，
  // 而不是把 Postgres 的约束名甩给运营看。
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "结束时间必须晚于开始时间" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lottery_settings")
    .update({
      enabled: input.enabled,
      cost_tickets: clampInt(input.costTickets, 1, 10),
      starts_at: startsAt ? startsAt.toISOString() : null,
      ends_at: endsAt ? endsAt.toISOString() : null,
      draws_per_day: clampInt(input.drawsPerDay, 0, 1000),
      cost_xp: clampInt(input.costXp, 0, 100_000),
      updated_at: new Date().toISOString(),
      updated_by: guard.profile.id,
    })
    .eq("id", true);

  if (error) return { error: error.message };
  revalidateCampaigns();
  return {};
}

export interface PrizeInput {
  name: string;
  icon: string;
  kind: LotteryPrizeKind;
  xpAmount: number;
  ticketAmount: number;
  badgeKey: string | null;
  weight: number;
  /** null = 不限量 */
  stock: number | null;
  isThanks: boolean;
  active: boolean;
}

// 奖位是固定的 8 个（九宫格外圈），所以是"改这一格"而不是"增删奖品"——
// position 就是主键级别的定位（表上有 unique (position)）。
export async function updateLotteryPrize(position: number, input: PrizeInput): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  if (position < 0 || position > 7) return { error: "奖位序号必须在 0-7 之间" };

  const name = input.name.trim();
  const icon = input.icon.trim();
  if (name.length < 1 || name.length > 20) return { error: "奖品名称需要在 1-20 字之间" };
  // 图标是直接渲染在格子里的 emoji，太长会把格子撑破。
  if (icon.length < 1 || icon.length > 4) return { error: "奖品图标请填 1 个 emoji" };
  if (input.kind === "badge" && !input.badgeKey) return { error: "徽章类奖品需要选择一个徽章" };
  if (input.kind === "ticket" && clampInt(input.ticketAmount, 0, 100) < 1) {
    return { error: "抽奖券奖品至少要奖励 1 张券" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("lottery_prizes")
    .update({
      name,
      icon,
      kind: input.kind,
      xp_amount: input.kind === "xp" ? clampInt(input.xpAmount, 0, 100_000) : 0,
      ticket_amount: input.kind === "ticket" ? clampInt(input.ticketAmount, 1, 100) : 0,
      badge_key: input.kind === "badge" ? input.badgeKey : null,
      weight: clampInt(input.weight, 0, 100_000),
      // 兜底奖位（谢谢参与）必须不限量：所有限量奖品抽完之后要还有东西可发，
      // 否则 perform_lottery_draw 只能返回"奖品已全部抽完"，抽奖直接不可用。
      stock: input.isThanks ? null : input.stock === null ? null : clampInt(input.stock, 0, 1_000_000),
      is_thanks: input.isThanks,
      active: input.active,
    })
    .eq("position", position);

  if (error) return { error: error.message };
  revalidateCampaigns();
  return {};
}

// 补货：把已送出数量清零，限量奖品就能再抽。
// 不动 lottery_draws（中奖记录是历史，不该被补货抹掉）。
export async function resetLotteryPrizeStock(position: number): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const admin = createAdminClient();
  const { error } = await admin.from("lottery_prizes").update({ awarded_count: 0 }).eq("position", position);
  if (error) return { error: error.message };

  await admin.from("admin_logs").insert({
    admin_id: guard.profile.id,
    action: "lottery_prize_restocked",
    target_type: "lottery_prize",
    detail: { position },
  });

  revalidateCampaigns();
  return {};
}

// 实物奖品的发放标记。运营线下发完货回来点一下，中奖列表就能区分"还没发"和"已发放"。
export async function setLotteryDrawFulfilled(drawId: string, fulfilled: boolean): Promise<{ error?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("lottery_draws")
    .update({ fulfilled_at: fulfilled ? new Date().toISOString() : null })
    .eq("id", drawId);

  if (error) return { error: error.message };
  revalidateCampaigns();
  return {};
}

// ========== 抽奖券发放 ==========
// 抽奖券是纯券制抽奖的唯一门槛，而券只有两个来源：这里的人工发放，和九宫格里的
// 「抽奖券」奖品。后者要先有券才够得着，所以**冷启动必须先从这里发一批**，
// 否则站上没人抽得动奖。

export async function grantLotteryTickets(
  userId: string,
  amount: number,
  note?: string
): Promise<{ error?: string; newBalance?: number }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const delta = clampInt(amount, -10_000, 10_000);
  if (delta === 0) return { error: "请输入一个非 0 的数量" };

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("grant_lottery_tickets", {
    p_user_id: userId,
    p_amount: delta,
    p_reason: "admin_grant",
    p_detail: { by: guard.profile.id, note: note?.trim() || null },
  });

  if (error) {
    console.error("[grantLotteryTickets] 发券失败:", error);
    return { error: error.message };
  }

  const row = (data as { changed: number; new_balance: number }[] | null)?.[0];

  // 发券和收券用户当时都不在现场，必须有通知——尤其是被收回的那种，
  // 余额平白少了却没有任何说明的话，用户只会来问客服。
  if (row && row.changed !== 0) {
    await notifyTicketChange(userId, row.changed, row.new_balance, "admin_grant");
  }

  await admin.from("admin_logs").insert({
    admin_id: guard.profile.id,
    action: "lottery_tickets_granted",
    target_type: "user",
    target_id: userId,
    detail: { amount: delta, note: note?.trim() || null, new_balance: row?.new_balance ?? null },
  });

  revalidateCampaigns();
  revalidatePath("/admin/users");
  return { newBalance: row?.new_balance ?? 0 };
}

// 活动管理页用的入口：那边没有用户列表，直接按用户名找人发券。
// 用户管理页是逐个用户操作（那里已经有搜索和整行的操作区），两边最终都走上面这个函数。
export async function grantLotteryTicketsByUsername(
  username: string,
  amount: number,
  note?: string
): Promise<{ error?: string; newBalance?: number; displayName?: string }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const trimmed = username.trim();
  if (!trimmed) return { error: "请输入用户名" };

  const admin = createAdminClient();
  // 用 ilike 而不是 eq：Google 登录的账号用户名大小写不受控（同 getUserCard）。
  // "_" 是 ilike 的通配符，用户名允许含下划线，要转义。
  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .ilike("username", trimmed.replace(/_/g, "\\_"))
    .maybeSingle();

  if (!profile) return { error: `找不到用户名为「${trimmed}」的用户` };

  const result = await grantLotteryTickets(profile.id, amount, note);
  if (result.error) return result;

  return { ...result, displayName: profile.display_name || profile.username || trimmed };
}

// ========== 手动补经验 / 直接设等级 ==========
// 冷启动（站里还没内容，谁都是 Lv0）和事后补偿（活动出问题、漏发奖励）都需要这个口子。
// 走的是同一套 award_xp 流水，所以补的分在用户的"经验明细"里能看到，也能触发升级通知。

export async function adjustUserXp(
  userId: string,
  amount: number,
  note?: string
): Promise<{ error?: string; newXp?: number; newLevel?: number }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const delta = clampInt(amount, -1_000_000, 1_000_000);
  if (delta === 0) return { error: "请输入一个非 0 的数值" };

  const result = await adjustXp({
    userId,
    action: "admin_adjust",
    amount: delta,
    refType: "admin",
    detail: { by: guard.profile.id, note: note?.trim() || null },
  });

  await notifyXpAdjusted(userId, delta, result.newXp);

  const admin = createAdminClient();
  await admin.from("admin_logs").insert({
    admin_id: guard.profile.id,
    action: "user_xp_adjusted",
    target_type: "user",
    target_id: userId,
    detail: { amount: delta, note: note?.trim() || null, new_xp: result.newXp },
  });

  revalidateCampaigns();
  revalidatePath("/admin/users");
  return { newXp: result.newXp, newLevel: result.newLevel };
}

// 直接指定等级：换算成"把经验值补到这一级的门槛"，而不是单独去写 profiles.level。
// 否则 level 和 xp 会对不上，用户的经验条会画出诡异的进度（比如 Lv5 但进度条是空的）。
export async function setUserLevel(
  userId: string,
  level: number
): Promise<{ error?: string; newXp?: number; newLevel?: number }> {
  const guard = await requirePermission("manage_campaigns");
  if ("error" in guard) return { error: guard.error };

  const target = clampInt(level, 0, MAX_LEVEL);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("xp").eq("id", userId).maybeSingle();
  if (!profile) return { error: "未找到该用户" };

  const targetXp = LEVEL_THRESHOLDS[target];
  const delta = targetXp - (profile.xp ?? 0);
  if (delta === 0) return { newXp: targetXp, newLevel: target };

  const result = await adjustXp({
    userId,
    action: "admin_adjust",
    amount: delta,
    refType: "admin",
    detail: { by: guard.profile.id, note: `直接设为 Lv${target}` },
  });

  await admin.from("admin_logs").insert({
    admin_id: guard.profile.id,
    action: "user_level_set",
    target_type: "user",
    target_id: userId,
    detail: { level: target, amount: delta, new_xp: result.newXp },
  });

  revalidateCampaigns();
  revalidatePath("/admin/users");
  return { newXp: result.newXp, newLevel: result.newLevel };
}
