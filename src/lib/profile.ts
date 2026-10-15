import { createClient } from "@/lib/supabase/server";
import type { Permissions, UserRole } from "@/lib/types";

export interface CurrentProfile {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  expertise: string[];
  role: UserRole;
  permissions: Permissions;
  xp: number;
  level: number;
  submissionCooldownUntil: string | null;
  mutedUntil: string | null;
  onboardedAt: string | null;
}

// 拿当前登录用户的 profile。Server Component / Server Action 都能用。
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, bio, expertise, role, permissions, submission_cooldown_until, muted_until, onboarded_at, xp, level"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    bio: profile.bio,
    expertise: profile.expertise ?? [],
    role: profile.role,
    permissions: (profile.permissions as Permissions) ?? {},
    xp: profile.xp ?? 0,
    level: profile.level ?? 0,
    submissionCooldownUntil: profile.submission_cooldown_until,
    mutedUntil: profile.muted_until,
    onboardedAt: profile.onboarded_at,
  };
}
