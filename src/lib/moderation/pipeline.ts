import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getModerationMode, type ModerationTargetType } from "@/lib/moderation/settings";
import { runAiModeration } from "@/lib/moderation/ai-review";
import { refreshBadgesForUser } from "@/lib/badges";

const TARGET_TABLE: Record<ModerationTargetType, "submissions" | "comments"> = {
  submission: "submissions",
  comment: "comments",
};

interface PipelineParams {
  targetType: ModerationTargetType;
  targetId: string;
  content: string;
  authorId: string;
  requireManual?: boolean;
}

// 提交/评论创建后调用一次：按管理员配置的审核模式（不审核/人工/AI）决定接下来发生什么。
// 所有写操作都用 admin client —— 这是系统级操作，不是"作者本人"的写权限范围。
//
// 返回这条内容最终的状态，省掉调用方再查一次数据库（发评论那条链路上每一次
// Supabase 往返都直接加在用户等待时间上）。
export async function runModerationPipeline(
  params: PipelineParams
): Promise<"pending" | "published"> {
  const supabase = await createClient();
  const mode = params.requireManual ? "manual" : await getModerationMode(supabase, params.targetType);
  const admin = createAdminClient();
  const table = TARGET_TABLE[params.targetType];

  if (mode === "none") {
    await admin.from(table).update({ status: "published" }).eq("id", params.targetId);
    // 徽章重算要好几次查询，而且和"这条内容能不能显示"无关，挪到响应之后做。
    after(() => refreshBadgesForUser(params.authorId));
    return "published";
  }

  const source = mode === "ai" ? "ai" : "human";
  await admin.from("moderation_queue").insert({
    target_type: params.targetType,
    target_id: params.targetId,
    source,
    result: "pending",
  });

  if (mode === "ai") {
    after(() => applyAiDecision(params));
  }
  return "pending";
}

async function applyAiDecision(params: PipelineParams): Promise<void> {
  const decision = await runAiModeration({ targetType: params.targetType, content: params.content });
  // 没有结果（没配 Key / 调用失败 / 超时）：什么都不做，留在人工队列里等人来处理。
  if (!decision) return;

  const admin = createAdminClient();
  const table = TARGET_TABLE[params.targetType];
  const status = decision.approved ? "published" : "rejected";

  await admin.from(table).update({ status }).eq("id", params.targetId);
  await admin
    .from("moderation_queue")
    .update({
      result: status === "published" ? "approved" : "rejected",
      reason: decision.reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("target_type", params.targetType)
    .eq("target_id", params.targetId)
    .eq("result", "pending");

  if (decision.approved) {
    await refreshBadgesForUser(params.authorId);
  }
}
