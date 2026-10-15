import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { requireAdmin, hasPermission } from "@/lib/admin-guard";
import { getAdminStats, purgeExpiredTrash } from "@/lib/admin-data";
import { AdminNav, type AdminNavItem } from "@/components/admin/admin-nav";

// 后台所有页面共用的外壳：一次身份校验 + 一条导航。
// 每个子页面自己再检查具体权限（Manager 可能只有其中一两项），
// 因为 layout 挡不住直接 POST 到 Server Action，Action 内部也各自查权限。
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // 后台是纯中文（不挂在 [locale] 段下，见 src/proxy.ts），但它复用了一些前台组件
  // （LevelBadge 之类），那些组件会调 useLocale() 来决定用哪种语言的文案。
  // 这里把语言钉死成中文并补上 Provider，共享组件在后台里就不会因为拿不到 locale 而报错。
  setRequestLocale("zh");
  const profile = await requireAdmin();

  // 「删除的内容超过一周自动清空」的执行点。数据库里不一定开了 pg_cron，
  // 所以每次有人打开后台就顺手清一遍——函数是幂等的，重复调用没有副作用。
  await purgeExpiredTrash();

  const stats = await getAdminStats();
  const canModerateSubmissions = hasPermission(profile, "moderate_submissions");
  const canModerateComments = hasPermission(profile, "moderate_comments");

  const items: AdminNavItem[] = [
    { href: "/admin", label: "总览" },
    { href: "/admin/analytics", label: "数据看板" },
    { href: "/admin/content", label: "内容审核", badge: stats.pendingQueue },
    { href: "/admin/trash", label: "回收站", badge: stats.trashItems },
    { href: "/admin/users", label: "用户管理" },
    { href: "/admin/reports", label: "举报管理", badge: stats.openReports },
    { href: "/admin/campaigns", label: "活动管理" },
  ].filter((item) => {
    if (item.href === "/admin/content") return canModerateSubmissions || canModerateComments;
    if (item.href === "/admin/trash") return canModerateSubmissions || canModerateComments;
    if (item.href === "/admin/reports") return canModerateComments;
    if (item.href === "/admin/campaigns") return hasPermission(profile, "manage_campaigns");
    if (item.href === "/admin/analytics") return hasPermission(profile, "view_analytics");
    return true;
  });

  return (
    <NextIntlClientProvider locale="zh" messages={{}}>
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">管理后台</h1>
          <p className="mt-1 text-sm text-muted">
            以 {profile.displayName ?? profile.username ?? "管理员"} 的身份登录 ·{" "}
            {profile.role === "admin" ? "Admin" : "Manager"}
          </p>
        </div>
      </header>

      <div className="mt-5 border-b border-line pb-3">
        <AdminNav items={items} />
      </div>

      <main className="mt-6">{children}</main>
    </div>
    </NextIntlClientProvider>
  );
}
