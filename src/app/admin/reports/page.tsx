import { requireAdmin, hasPermission } from "@/lib/admin-guard";
import { getCommentReports } from "@/lib/admin-data";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { FilterTabs, Pagination } from "@/components/admin/list-controls";
import { AdminPanel, NoPermissionNotice } from "@/components/admin/ui";
import type { CommentReportStatus } from "@/lib/types";

const PAGE_SIZE = 25;

// 「已处理」在界面上是一个 tab，底层是 resolved（举报成立）+ dismissed（驳回）两个状态，
// getCommentReports 用 handled 这个伪状态把它们合起来查。
const STATUS_OPTIONS = [
  { value: "open", label: "未处理" },
  { value: "handled", label: "已处理" },
  { value: "all", label: "全部" },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const profile = await requireAdmin();
  if (!hasPermission(profile, "moderate_comments")) return <NoPermissionNotice what="举报管理" />;

  const params = await searchParams;
  const status = (params.status ?? "open") as CommentReportStatus | "handled" | "all";
  const page = Number(params.page ?? "1") || 1;

  const [reports, openCount] = await Promise.all([
    getCommentReports({ status, page, pageSize: PAGE_SIZE }),
    // tab 上的未处理数量要一直显示真实值，不能跟着当前筛选变。
    getCommentReports({ status: "open", page: 1, pageSize: 1 }).then((result) => result.total),
  ]);

  const options = STATUS_OPTIONS.map((option) =>
    option.value === "open" ? { ...option, count: openCount } : option
  );

  return (
    <AdminPanel
      title="举报管理"
      count={reports.total}
      description="驳回不成立的举报，或者通过并处置：删除评论、禁言作者（1 / 3 / 7 天或永久）"
    >
      <FilterTabs paramKey="status" options={options} defaultValue="open" />

      <div className="mt-4">
        <ReportsPanel reports={reports.rows} />
        <Pagination page={reports.page} pageSize={reports.pageSize} total={reports.total} />
      </div>
    </AdminPanel>
  );
}
