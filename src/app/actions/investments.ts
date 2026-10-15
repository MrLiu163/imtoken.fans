"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { refreshBadgesForUser } from "@/lib/badges";
import { awardXpByRule } from "@/lib/xp";

const MAX_AMOUNT = 1_000_000;

export async function castSimulatedInvestment(
  submissionId: string,
  amountUsd: number,
  pathname: string
): Promise<{ error?: string }> {
  const t = await getTranslations("errors");
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > MAX_AMOUNT) {
    return { error: t("investAmount", { max: MAX_AMOUNT.toLocaleString() }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase.from("investments").insert({
    submission_id: submissionId,
    user_id: user.id,
    type: "simulated",
    amount: amountUsd,
  });
  if (error) return { error: error.message };

  await refreshBadgesForUser(user.id);

  // 同一个项目多次追加投资只算一次经验（refId = 提交 id）。
  after(() =>
    awardXpByRule({
      userId: user.id,
      action: "simulated_investment",
      refType: "submission",
      refId: submissionId,
    })
  );

  revalidatePath(pathname);
  return {};
}
