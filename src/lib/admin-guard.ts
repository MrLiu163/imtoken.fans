import { redirect } from "next/navigation";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profile";
import type { PermissionKey } from "@/lib/types";

export function hasPermission(profile: CurrentProfile, key: PermissionKey): boolean {
  if (profile.role === "admin") return true;
  if (profile.role === "member") return Boolean(profile.permissions[key]);
  return false;
}

// 页面用：不是 admin/member 直接跳走首页。只挡得住导航，挡不住直接 POST 到 Server Action，
// 所以每个需要权限的 Server Action 内部还要单独调用 requirePermission()。
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "member")) {
    redirect("/");
  }
  return profile;
}

// Server Action 用：返回错误而不是硬跳转，按钮点到一半不该被重定向打断。
export async function requirePermission(
  key: PermissionKey
): Promise<{ profile: CurrentProfile } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "请先登录" };
  if (!hasPermission(profile, key)) return { error: "没有权限执行这个操作" };
  return { profile };
}

// 角色管理（谁是 admin/member/user）本身只有 admin 能操作，不下放给 member。
export async function requireAdminForAction(): Promise<{ profile: CurrentProfile } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "请先登录" };
  if (profile.role !== "admin") return { error: "没有管理员权限" };
  return { profile };
}
