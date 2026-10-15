import { requireAdmin, hasPermission } from "@/lib/admin-guard";
import { getAdminStats, getAdminUsers } from "@/lib/admin-data";
import { UserTable } from "@/components/admin/user-table";
import { FilterTabs, Pagination, SearchInput } from "@/components/admin/list-controls";
import { AdminPanel } from "@/components/admin/ui";
import type { UserRole } from "@/lib/types";

const PAGE_SIZE = 25;

// 默认落在 staff（Admin + Manager）这一档：日常最常看的是「谁有后台权限」，
// 要找某个普通用户就用搜索框，不用先翻几十页。
const ROLE_OPTIONS = [
  { value: "staff", label: "Admin / Manager" },
  { value: "all", label: "全部用户" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Manager" },
  { value: "user", label: "普通用户" },
];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string; q?: string; page?: string }>;
}) {
  const profile = await requireAdmin();
  const params = await searchParams;

  const role = (params.role ?? "staff") as UserRole | "staff" | "all";
  const q = params.q ?? "";
  const page = Number(params.page ?? "1") || 1;

  const [stats, users] = await Promise.all([
    getAdminStats(),
    getAdminUsers({ role, q, page, pageSize: PAGE_SIZE }),
  ]);

  return (
    <AdminPanel
      title="用户管理"
      count={users.total}
      description={`全站 ${stats.totalUsers} 人，其中 ${stats.staffUsers} 人拥有后台权限，${stats.mutedUsers} 人处于禁言中`}
    >
      <div className="flex flex-col gap-3">
        <SearchInput placeholder="搜索用户名、昵称或钱包地址…" />
        <FilterTabs paramKey="role" options={ROLE_OPTIONS} defaultValue="staff" />
      </div>

      <div className="mt-4">
        <UserTable
          users={users.rows}
          viewerId={profile.id}
          viewerIsAdmin={profile.role === "admin"}
          viewerCanManageTags={hasPermission(profile, "manage_user_tags")}
          viewerCanGrantBadges={hasPermission(profile, "grant_badges")}
          viewerCanMuteUsers={hasPermission(profile, "moderate_comments")}
          viewerCanManageCampaigns={hasPermission(profile, "manage_campaigns")}
        />
        <Pagination page={users.page} pageSize={users.pageSize} total={users.total} />
      </div>
    </AdminPanel>
  );
}
