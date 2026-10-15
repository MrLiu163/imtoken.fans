import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBadgeAwarded } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

export interface UserBadge {
  badge_key: string;
  level: number;
  awarded_at: string;
}

// badges 是公开可读的（RLS: select using (true)），走普通客户端读就行。
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("badges")
    .select("badge_key, level, awarded_at")
    .eq("user_id", userId)
    .order("awarded_at", { ascending: true });
  return data ?? [];
}

// 重新计算并 upsert 一个用户当前应该拥有的（除 genesis_member 之外的）徽章。
// badges 表没有普通用户的 insert 策略，所以这里必须用 admin client（绕过 RLS）。
// 徽章只会"新增"，不会因为条件不再满足就撤销。
export async function refreshBadgesForUser(userId: string): Promise<void> {
  const admin = createAdminClient();

  const [{ count: ideaCount }, { count: commentCount }, investmentsResult] = await Promise.all([
    admin
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", userId)
      .eq("type", "idea")
      .eq("status", "published"),
    admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published"),
    admin.from("investments").select("submission_id").eq("user_id", userId).eq("type", "simulated"),
  ]);

  const backedProjectCount = new Set((investmentsResult.data ?? []).map((row) => row.submission_id)).size;

  const badgesToAward: string[] = [];
  if ((ideaCount ?? 0) >= 1) badgesToAward.push("ideas");
  if ((commentCount ?? 0) >= 1) badgesToAward.push("contributions");
  if (backedProjectCount >= 1) badgesToAward.push("backed_projects");

  if (badgesToAward.length === 0) return;

  // ignoreDuplicates 的 upsert 加上 .select() 只会回传真正新插入的行，
  // 正好拿来判断"这次到底是不是第一次拿到"——否则每次刷新都会重发一遍通知。
  const { data: inserted } = await admin
    .from("badges")
    .upsert(
      badgesToAward.map((badgeKey) => ({ user_id: userId, badge_key: badgeKey, level: 1 })),
      { onConflict: "user_id,badge_key", ignoreDuplicates: true }
    )
    .select("badge_key");

  for (const row of inserted ?? []) {
    await notifyBadgeAwarded(userId, row.badge_key);
  }
}
