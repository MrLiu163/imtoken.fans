"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { awardXpByRule } from "@/lib/xp";

export type VoteType = "paid" | "creative";

// 先删后插而不是先查再判断：双击/重试时插入若撞上唯一键（23505），当成"已经投过"处理，
// 避免出现"查的时候没有、插的时候已经存在"的竞态错误。
export async function toggleVote(
  submissionId: string,
  voteType: VoteType,
  pathname: string
): Promise<{ error: string } | { voted: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const t = await getTranslations("errors");
    return { error: t("notSignedIn") };
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("votes")
    .delete()
    .eq("submission_id", submissionId)
    .eq("user_id", user.id)
    .eq("vote_type", voteType)
    .select("id");

  if (deleteError) return { error: deleteError.message };

  if (deleted && deleted.length > 0) {
    revalidatePath(pathname);
    return { voted: false };
  }

  const { error: insertError } = await supabase
    .from("votes")
    .insert({ submission_id: submissionId, user_id: user.id, vote_type: voteType });

  if (insertError && insertError.code !== "23505") {
    return { error: insertError.message };
  }

  // 参与投票的经验按「作品」去重（refId = 提交 id），不按票种：
  // 一个作品有"愿意付费"和"很有创意"两个票种，都投也只算一次，
  // 取消再投同样不会重复加分（幂等由 xp_events 的唯一索引兜住）。
  after(() =>
    awardXpByRule({
      userId: user.id,
      action: "vote_cast",
      refType: "submission",
      refId: submissionId,
    })
  );

  revalidatePath(pathname);
  return { voted: true };
}
