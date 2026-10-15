"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserRole, UserTagKey } from "@/lib/types";

export interface MentionCandidate {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

// @提及自动补全用：profiles 本来公开可读（RLS: select using (true)），普通客户端就够。
export async function searchUsersForMention(query: string): Promise<MentionCandidate[]> {
  const trimmed = query.trim();
  if (trimmed.length < 1) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .not("username", "is", null)
    // 用户名和昵称都能搜到（打中文昵称也找得到人），但插入正文的始终是唯一的 username。
    // "_" 是 ilike 的通配符，用户名允许含下划线，要转义。
    .or(`username.ilike.${trimmed.replace(/_/g, "\\_")}%,display_name.ilike.%${trimmed}%`)
    .limit(6);

  return (data ?? [])
    .filter((row): row is { id: string; username: string; display_name: string | null; avatar_url: string | null } =>
      Boolean(row.username)
    )
    .map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
    }));
}

// ========== 悬停名片 ==========

export interface UserCard {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  level: number;
  xp: number;
  tags: UserTagKey[];
  badgeKeys: string[];
  submissionCount: number;
  joinedAt: string;
}

// 评论区 hover 头像时按需拉一次，前端会按用户名缓存，所以这里不做额外缓存。
// profiles / user_tags / badges 都是公开可读的（RLS: select using (true)），普通客户端就够。
export async function getUserCard(username: string): Promise<UserCard | null> {
  const trimmed = username.trim();
  if (!trimmed) return null;

  const supabase = await createClient();
  // 用 ilike 而不是 eq：Google 登录的账号用户名大小写不受控（同 getPublicProfileByUsername）。
  // "_" 是 ilike 的通配符，用户名允许含下划线，要转义。
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, role, created_at, xp, level")
    .ilike("username", trimmed.replace(/_/g, "\\_"))
    .maybeSingle();

  if (!profile || !profile.username) return null;

  const [{ data: tagRows }, { data: badgeRows }, { count }] = await Promise.all([
    supabase.from("user_tags").select("tag_key").eq("user_id", profile.id),
    supabase.from("badges").select("badge_key").eq("user_id", profile.id).order("awarded_at", { ascending: true }),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("submitted_by", profile.id)
      .eq("status", "published"),
  ]);

  return {
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    role: profile.role,
    level: profile.level ?? 0,
    xp: profile.xp ?? 0,
    tags: (tagRows ?? []).map((r) => r.tag_key as UserTagKey),
    badgeKeys: (badgeRows ?? []).map((r) => r.badge_key),
    submissionCount: count ?? 0,
    joinedAt: profile.created_at,
  };
}
