import { useLocale } from "next-intl";
import { USER_TAG_INFO, roleLabel, userTagLabel, type UserRole, type UserTagKey } from "@/lib/types";
import { LevelBadge } from "@/components/level-badge";

// 角色标记有两种形态，由调用方按场地宽窄选：
//   icon —— 盾牌图标（管理员实心 + 品牌底，成员描边 + 浅底），hover 出文字。
//           只给评论区用：那一行经常已经挤着「等级 + 角色 + ⭐ + ✔️」，
//           再塞"管理员"三个字会把名字挤到一边。
//   text —— 文字胶囊。用户名片、个人主页、作品详情这些地方不缺空间，
//           直接写清楚比让人去 hover 强。
// 两种形态都保证读屏能念出角色名（icon 那版靠 aria-label）。
export function RoleBadge({ role }: { role: UserRole }) {
  const locale = useLocale();
  const isAdmin = role === "admin";
  const label = roleLabel(role, locale);

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
        isAdmin ? "bg-brand text-white" : "bg-brand-soft text-brand-ink"
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill={isAdmin ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3l7 3v5.2c0 4.3-2.9 8.1-7 9.3-4.1-1.2-7-5-7-9.3V6l7-3z" />
      </svg>
    </span>
  );
}

// 纯展示组件：角色标签只展示 member/admin（user 是默认身份，不用特别标注），
// 用户标签（VIP/认证/黑名单）和角色是两回事，分开渲染。
//
// 等级排在最前面：这一行经常挤着「等级 + 角色 + ⭐ + ✔️」好几个标记，
// 等级是最常被扫到的信息，放第一位。
//
// Lv0 也要显示：等级是每个人都有的属性，只有高等级才挂徽章的话，
// 一眼看过去会以为"没徽章的人是另一类用户"，而不是"他还在 Lv0"。
// 只有在调用方压根没传 level（拿不到这个数据的旧调用点）时才不渲染。
export function RoleTag({ role }: { role: UserRole }) {
  const locale = useLocale();
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] font-medium ${
        role === "admin" ? "bg-brand text-white" : "bg-brand-soft text-brand-ink"
      }`}
    >
      {roleLabel(role, locale)}
    </span>
  );
}

export function UserBadgeInline({
  role,
  tags,
  level,
  roleStyle = "text",
}: {
  role?: UserRole | null;
  tags?: UserTagKey[];
  level?: number | null;
  /** 角色标记的形态，默认文字。只有评论区传 "icon" */
  roleStyle?: "text" | "icon";
}) {
  const locale = useLocale();
  const showRole = role === "admin" || role === "member";
  const showLevel = typeof level === "number";
  if (!showLevel && !showRole && (!tags || tags.length === 0)) return null;

  return (
    <span className="inline-flex items-center gap-1">
      {showLevel && <LevelBadge level={level} size="xs" />}
      {showRole && role && (roleStyle === "icon" ? <RoleBadge role={role} /> : <RoleTag role={role} />)}
      {tags?.map((tag) => (
        <span key={tag} title={userTagLabel(tag, locale)} className="text-xs leading-none">
          {USER_TAG_INFO[tag].icon}
        </span>
      ))}
    </span>
  );
}
