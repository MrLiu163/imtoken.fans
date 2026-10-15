import type { SupabaseClient } from "@supabase/supabase-js";

export type ModerationTargetType = "submission" | "comment";
export type ModerationMode = "none" | "human" | "ai";

// moderation_settings 是公开可读的（RLS: select using (true)），走普通客户端读就行，不用 admin client。
export async function getModerationMode(
  supabase: SupabaseClient,
  targetType: ModerationTargetType
): Promise<ModerationMode> {
  const { data } = await supabase
    .from("moderation_settings")
    .select("mode")
    .eq("target_type", targetType)
    .maybeSingle();

  return (data?.mode as ModerationMode | undefined) ?? "human";
}
