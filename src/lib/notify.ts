import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 站内通知的写入口。所有"发生在用户身上、但用户当时不在现场"的事都从这里发：
// 升级、抽奖券到账、拿到徽章、管理员调整经验。
//
// 这几类通知没有"触发人"，也不挂在某条内容上（actor_id / submission_id / comment_id 全为空），
// 具体数值放在 detail 里，由通知铃铛按类型分别渲染。
//
// notifications 表没有开放给 authenticated 的 insert 策略（防伪造通知），一律走 service_role。
// 通知失败只记日志不抛错：发通知是附带动作，不该把"发券成功了"这件事一起搞挂。

async function insertNotification(
  userId: string,
  type: "level_up" | "lottery_ticket" | "badge" | "xp_adjust",
  detail: Record<string, unknown>
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({ user_id: userId, type, detail });
  if (error) console.error(`[notify:${type}] 写通知失败:`, error);
}

export async function createLevelUpNotification(userId: string, level: number): Promise<void> {
  await insertNotification(userId, "level_up", { level });
}

/**
 * 抽奖券变动。amount 为负表示被收回（管理员操作），同样要通知——
 * 用户看到余额少了却没有任何说明，只会来问客服。
 */
export async function notifyTicketChange(
  userId: string,
  amount: number,
  balance: number,
  source: "admin_grant" | "lottery_prize"
): Promise<void> {
  if (amount === 0) return;
  await insertNotification(userId, "lottery_ticket", { amount, balance, source });
}

export async function notifyBadgeAwarded(userId: string, badgeKey: string): Promise<void> {
  await insertNotification(userId, "badge", { badge_key: badgeKey });
}

/** 管理员手动补 / 扣经验。用户自己的行为加的经验不发通知（那些他当时就在现场）。 */
export async function notifyXpAdjusted(userId: string, amount: number, xp: number): Promise<void> {
  if (amount === 0) return;
  await insertNotification(userId, "xp_adjust", { amount, xp });
}
