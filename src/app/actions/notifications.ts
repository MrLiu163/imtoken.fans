"use server";

import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// notifications 的 RLS 只开放本人 select/update，普通客户端就够，不需要 admin client。
export async function markNotificationRead(notificationId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const t = await getTranslations("errors");
    return { error: t("notSignedIn") };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };
  return {};
}

export async function markAllNotificationsRead(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const t = await getTranslations("errors");
    return { error: t("notSignedIn") };
  }

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) return { error: error.message };
  return {};
}

// 清空：直接删行，不是软清除。RLS 见 0015（本人才能删自己的通知）。
export async function clearAllNotifications(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const t = await getTranslations("errors");
    return { error: t("notSignedIn") };
  }

  const { error } = await supabase.from("notifications").delete().eq("user_id", user.id);

  if (error) return { error: error.message };
  return {};
}
