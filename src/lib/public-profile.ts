import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

export interface PublicProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  xp: number;
  level: number;
  createdAt: string;
}

// /u/[username] 极简公开主页用：profiles 本来就公开可读（RLS: select using (true)），
// 普通客户端直接查就行，不需要 admin client。
// 用 ilike 而不是 eq：Google 登录的账号直接拿 full_name 当 username（见 src/lib/mentions.ts
// 顶部注释），大小写不受控，评论里 @提及渲染出来的链接可能和数据库里存的大小写不完全一致。
export async function getPublicProfileByUsername(username: string): Promise<PublicProfile | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, role, created_at, xp, level")
    .ilike("username", username.replace(/_/g, "\\_"))
    .maybeSingle();

  if (!data || !data.username) return null;

  return {
    id: data.id,
    username: data.username,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    bio: data.bio,
    role: data.role,
    xp: data.xp ?? 0,
    level: data.level ?? 0,
    createdAt: data.created_at,
  };
}
