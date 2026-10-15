import { requireAdmin, hasPermission } from "@/lib/admin-guard";
import { isAiModerationConfigured } from "@/lib/moderation/config";
import {
  getAdminStats,
  getAdminUsers,
  getCommentReports,
  getModerationModes,
  getPendingQueueItems,
  getSubmissionsForAdmin,
  getTrashItems,
} from "@/lib/admin-data";
import { getTodayActivity, getTodayTraffic } from "@/lib/analytics-data";
import { ModerationSettingsPanel } from "@/components/admin/moderation-settings-panel";
import { ModerationQueuePanel } from "@/components/admin/moderation-queue-panel";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { SubmissionTable } from "@/components/admin/submission-table";
import { TrashPanel } from "@/components/admin/trash-panel";
import { UserTable } from "@/components/admin/user-table";
import { AdminPanel, StatCard, ViewAllLink } from "@/components/admin/ui";

// 总览页：每个板块只显示最近几条，完整记录去各自的独立页面。
// 内容和用户都可能上千条，全塞在一页里既慢又没法用（这就是重构前的问题）。
const RECENT_LIMIT = 5;

export default async function AdminDashboardPage() {
  const profile = await requireAdmin();

  const canModerateSubmissions = hasPermission(profile, "moderate_submissions");
  const canModerateComments = hasPermission(profile, "moderate_comments");
  const canManageTags = hasPermission(profile, "manage_user_tags");
  const canGrantBadges = hasPermission(profile, "grant_badges");
  const canManageCampaigns = hasPermission(profile, "manage_campaigns");
  const canViewAnalytics = hasPermission(profile, "view_analytics");
  const isAdmin = profile.role === "admin";

  const [stats, modes, queueItems, submissions, reports, staff, trash, traffic, activity] = await Promise.all([
    getAdminStats(),
    getModerationModes(),
    getPendingQueueItems(RECENT_LIMIT * 2),
    canModerateSubmissions
      ? getSubmissionsForAdmin({ page: 1, pageSize: RECENT_LIMIT })
      : Promise.resolve(null),
    canModerateComments
      ? getCommentReports({ status: "open", page: 1, pageSize: RECENT_LIMIT })
      : Promise.resolve(null),
    // 总览页的用户板块只显示 Admin + Manager（团队成员），普通用户去用户管理页搜。
    getAdminUsers({ role: "staff", page: 1, pageSize: RECENT_LIMIT * 2 }),
    canModerateSubmissions || canModerateComments ? getTrashItems(RECENT_LIMIT) : Promise.resolve([]),
    // 今日访问 / 今日活动：只有能看看板的人才查，省掉两次没人看的往返。
    canViewAnalytics ? getTodayTraffic() : Promise.resolve(null),
    canViewAnalytics ? getTodayActivity() : Promise.resolve(null),
  ]);

  // 提交队列要 moderate_submissions，评论队列要 moderate_comments——各自过滤成当前用户真的能处理的部分。
  const visibleQueueItems = queueItems
    .filter((item) => (item.target_type === "submission" ? canModerateSubmissions : canModerateComments))
    .slice(0, RECENT_LIMIT);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {traffic && (
          <StatCard
            label="今日访问"
            value={traffic.today.views}
            hint={`${traffic.today.visitors} 位访客 · 昨日 ${traffic.yesterday.views}`}
            href="/admin/analytics"
          />
        )}
        {activity && (
          <StatCard
            label="今日活动"
            value={activity.checkinUsers}
            hint={`人签到 · 抽奖 ${activity.draws} 次`}
            href="/admin/analytics?range=7"
          />
        )}
        <StatCard
          label="待审核"
          value={stats.pendingQueue}
          hint="审核队列"
          href="/admin/content"
          tone={stats.pendingQueue > 0 ? "warn" : "neutral"}
        />
        <StatCard
          label="待处理举报"
          value={stats.openReports}
          hint="评论举报"
          href="/admin/reports"
          tone={stats.openReports > 0 ? "risk" : "neutral"}
        />
        <StatCard label="已发布内容" value={stats.publishedSubmissions} hint={`${stats.pendingSubmissions} 条待审`} href="/admin/content" />
        <StatCard label="用户" value={stats.totalUsers} hint={`${stats.staffUsers} 名管理者 · ${stats.mutedUsers} 人被禁言`} href="/admin/users" />
      </div>

      {isAdmin && <ModerationSettingsPanel initialModes={modes} aiConfigured={isAiModerationConfigured()} />}

      {(canModerateSubmissions || canModerateComments) && (
        <AdminPanel
          title="审核队列"
          count={stats.pendingQueue}
          description="最近待审核的内容"
          action={<ViewAllLink href="/admin/content" />}
        >
          <ModerationQueuePanel items={visibleQueueItems} />
        </AdminPanel>
      )}

      {reports && (
        <AdminPanel
          title="待处理举报"
          count={stats.openReports}
          description="最近收到的评论举报"
          action={<ViewAllLink href="/admin/reports" />}
        >
          <ReportsPanel reports={reports.rows} />
        </AdminPanel>
      )}

      {submissions && (
        <AdminPanel
          title="最新内容"
          count={submissions.total}
          description="最近发布的产品与点子"
          action={<ViewAllLink href="/admin/content" />}
        >
          <SubmissionTable submissions={submissions.rows} />
        </AdminPanel>
      )}

      <AdminPanel
        title="Admin / Manager"
        count={stats.staffUsers}
        description="拥有后台权限的账号"
        action={<ViewAllLink href="/admin/users" label="全部用户" />}
      >
        <UserTable
          users={staff.rows}
          viewerId={profile.id}
          viewerIsAdmin={isAdmin}
          viewerCanManageTags={canManageTags}
          viewerCanGrantBadges={canGrantBadges}
          viewerCanMuteUsers={canModerateComments}
          viewerCanManageCampaigns={canManageCampaigns}
        />
      </AdminPanel>

      {(canModerateSubmissions || canModerateComments) && (
        <AdminPanel
          title="回收站"
          count={stats.trashItems}
          description="删除的内容保留 7 天，之后自动清空"
          action={<ViewAllLink href="/admin/trash" />}
        >
          <TrashPanel items={trash} viewerIsAdmin={isAdmin} />
        </AdminPanel>
      )}
    </div>
  );
}
