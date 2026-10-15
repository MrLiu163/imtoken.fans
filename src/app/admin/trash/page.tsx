import { requireAdmin, hasPermission } from "@/lib/admin-guard";
import { getTrashItems } from "@/lib/admin-data";
import { TrashPanel } from "@/components/admin/trash-panel";
import { AdminPanel, NoPermissionNotice } from "@/components/admin/ui";
import { TRASH_RETENTION_DAYS } from "@/lib/types";

// 回收站：被删除的评论和内容。恢复权限跟着内容类型走，所以这里按权限过滤条目，
// 只有 moderate_comments 的 Manager 看不到被删的提交，反之亦然。
export default async function AdminTrashPage() {
  const profile = await requireAdmin();
  const canModerateSubmissions = hasPermission(profile, "moderate_submissions");
  const canModerateComments = hasPermission(profile, "moderate_comments");

  if (!canModerateSubmissions && !canModerateComments) return <NoPermissionNotice what="回收站" />;

  const allItems = await getTrashItems();
  const items = allItems.filter((item) =>
    item.kind === "submission" ? canModerateSubmissions : canModerateComments
  );

  return (
    <AdminPanel
      title="回收站"
      count={items.length}
      description={`删除的内容在这里保留 ${TRASH_RETENTION_DAYS} 天，可以随时恢复；超过 ${TRASH_RETENTION_DAYS} 天自动彻底清除，不可找回。`}
    >
      <TrashPanel items={items} viewerIsAdmin={profile.role === "admin"} />
    </AdminPanel>
  );
}
