import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SubmissionCard } from "@/lib/types";
import { getTagLabel } from "@/lib/tag-taxonomy";
import { Avatar } from "@/components/avatar";

// 点子卡片。和产品列表（submission-list-row.tsx）故意长得不一样：
//
//   产品 = 已经上线的东西，要"严谨"：Logo、排名、票数格子、运营数据，像一份档案。
//   点子 = 还没做出来的想法，要"随意"：不给 Logo（点子还没有品牌，硬塞一个首字母
//          方块只是占位噪音），把版面让给标题和内容本身，作者头像放在末尾像一条随手贴。
//
// 所以这里：无图标、标题放大、一句话简介 + 详细描述各占一行，标签平铺，
// 底部一行是"谁提的 + 多久之前 + 评论数 + 票数"。
const MAX_TAGS_SHOWN = 4;

export function IdeaListRow({
  submission,
  now,
}: {
  submission: SubmissionCard;
  /** 渲染这一批卡片时的服务端时间戳。相对时间必须用同一个基准算，
   *  否则服务端和浏览器各取一次 Date.now()，hydration 会对不上。 */
  now: number;
}) {
  const t = useTranslations("ideaRow");
  const tc = useTranslations("common");
  const locale = useLocale();

  const score = submission.votes_paid + submission.votes_creative;
  const author = submission.submitted_by_username;
  const shownTags = submission.tags.slice(0, MAX_TAGS_SHOWN);
  const hiddenTagCount = submission.tags.length - shownTags.length;

  return (
    <Link
      href={`/ideas/${submission.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand/50 hover:bg-surface-2/40 sm:p-5"
    >
      <div className="min-w-0">
        <h3 className="text-base font-bold leading-snug text-ink transition-colors group-hover:text-brand-ink sm:text-lg">
          <span aria-hidden className="mr-1.5">
            💡
          </span>
          {submission.title}
        </h3>
        <p className="mt-1.5 text-sm leading-6 text-ink/85">{submission.tagline}</p>
        {submission.description && (
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] leading-6 text-muted">
            {submission.description}
          </p>
        )}
      </div>

      {shownTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {shownTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-brand-soft/70 px-2.5 py-0.5 text-[11px] font-medium text-brand-ink"
            >
              {getTagLabel(tag, locale)}
            </span>
          ))}
          {hiddenTagCount > 0 && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-faint">
              {t("moreTags", { count: hiddenTagCount })}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
        <span className="flex min-w-0 items-center gap-1.5">
          <Avatar
            src={submission.submitted_by_avatar_url}
            name={author}
            className="h-5 w-5 rounded-full bg-surface-2 font-display text-[9px] font-bold text-muted"
          />
          <span className="truncate">{author ? `@${author}` : tc("anonymous")}</span>
        </span>
        <span className="font-mono text-[11px] text-faint">
          {relativeTime(submission.created_at, now, t)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3 font-medium">
          <span
            className="flex items-center gap-1"
            title={t("comments", { count: submission.comment_count })}
          >
            <CommentIcon />
            {submission.comment_count}
          </span>
          <span className="flex items-center gap-1 text-brand-ink" title={t("votes", { count: score })}>
            <UpvoteIcon />
            {score}
          </span>
        </span>
      </div>
    </Link>
  );
}

// 相对时间自己算：只有"刚刚 / N 分钟前 / N 小时前 / N 天前"四档，
// 超过 30 天就退回 ISO 的 YYYY-MM-DD——两种语言都读得懂，而且不受 locale
// 默认拼法和时区影响，服务端和浏览器一定算出同一个字符串。
function relativeTime(iso: string, now: number, t: ReturnType<typeof useTranslations<"ideaRow">>): string {
  const diffMs = Math.max(0, now - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("hoursAgo", { count: hours });
  const days = Math.floor(hours / 24);
  if (days <= 30) return t("daysAgo", { count: days });
  return new Date(iso).toISOString().slice(0, 10);
}

function CommentIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.62-.32-3.73-.9L4 20l1.2-4.2A8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function UpvoteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
