"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getSubmissionMediaUrl } from "@/lib/media";
import { normalizeUsername } from "@/lib/username";
import { normalizeExpertise } from "@/lib/expertise";
import { normalizeIntents } from "@/lib/intents";

const BIO_MAX_LENGTH = 200;

export async function updateProfile(input: {
  displayName: string;
  username: string;
  bio: string;
  expertise: string[];
  avatarPath?: string;
}): Promise<{ error: string } | { success: true }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (displayName.length < 1 || displayName.length > 30) return { error: t("displayNameLength") };
  if (bio.length > BIO_MAX_LENGTH) return { error: t("bioTooLong", { max: BIO_MAX_LENGTH }) };

  // username 是对外唯一标识，格式受数据库 profiles_username_format 约束（见 0011），
  // 这里必须先按同一套规则校验——否则填了带空格/中文的名字会直接撞约束报一个看不懂的错。
  const username = normalizeUsername(input.username);
  if (!username) {
    return { error: t("usernameFormat") };
  }

  const update: { display_name: string; username: string; bio: string; expertise: string[]; avatar_url?: string } = {
    display_name: displayName,
    username,
    bio,
    expertise: normalizeExpertise(input.expertise),
  };
  if (input.avatarPath) update.avatar_url = getSubmissionMediaUrl(input.avatarPath);

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: t("usernameTaken") };
    return { error: error.message };
  }

  revalidatePath("/profile");
  return { success: true };
}


// ========== 首次登录引导 ==========

// 引导页保存：昵称 + 用户名 + 简介 + 头像，一次写完并标记引导已完成。
// username 走 normalizeUsername 校验（要唯一、要能被 @ 正则解析、要能当 URL 路径），
// displayName 不做格式限制（可重复、可中文、可带空格）。
export async function completeOnboarding(input: {
  displayName: string;
  username: string;
  bio: string;
  expertise: string[];
  intents?: string[];
  avatarPath?: string;
}): Promise<{ error: string } | { success: true }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const displayName = input.displayName.trim();
  const bio = input.bio.trim();
  if (displayName.length < 1 || displayName.length > 30) return { error: t("displayNameLength") };
  if (bio.length > BIO_MAX_LENGTH) return { error: t("bioTooLong", { max: BIO_MAX_LENGTH }) };

  const username = normalizeUsername(input.username);
  if (!username) {
    return { error: t("usernameFormat") };
  }

  const update: {
    display_name: string;
    username: string;
    bio: string;
    expertise: string[];
    intents: string[];
    onboarded_at: string;
    avatar_url?: string;
  } = {
    display_name: displayName,
    username,
    bio,
    expertise: normalizeExpertise(input.expertise),
    intents: normalizeIntents(input.intents ?? []),
    onboarded_at: new Date().toISOString(),
  };
  if (input.avatarPath) update.avatar_url = getSubmissionMediaUrl(input.avatarPath);

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    if (error.code === "23505") return { error: t("usernameTaken") };
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

// 点了「以后再说」：只记一个时间戳，之后不再拦人，资料留空由用户自己去 /profile 补。
export async function skipOnboarding(): Promise<{ error?: string }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
