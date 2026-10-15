"use client";

import { useRef, useState, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { getUserCard, type UserCard } from "@/app/actions/users";
import { USER_TAG_INFO, badgeInfo, userTagLabel } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { RoleTag } from "@/components/user-badge-inline";
import { LevelBadge } from "@/components/level-badge";

// 按用户名缓存在模块级：同一个人在评论区往往出现多次，来回 hover 不该每次都打服务端。
// 值为 null 表示"查过了，这个用户名不存在"，同样要缓存，避免反复重试。
const cardCache = new Map<string, UserCard | null>();

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 200;

export function UserHoverCard({
  username,
  children,
  className,
}: {
  username: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("userCard");
  const [card, setCard] = useState<UserCard | null | undefined>(() => cardCache.get(username));
  const [open, setOpen] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);

  function clearTimers() {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }

  function handleEnter() {
    clearTimers();
    openTimer.current = setTimeout(async () => {
      // 名片高度约 200px，靠近视口底部时往上翻，不然会被裁掉。
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setFlipUp(window.innerHeight - rect.bottom < 240);
      setOpen(true);

      if (cardCache.has(username)) {
        setCard(cardCache.get(username));
        return;
      }
      const result = await getUserCard(username);
      cardCache.set(username, result);
      setCard(result);
    }, OPEN_DELAY_MS);
  }

  function handleLeave() {
    clearTimers();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {open && (
        <span
          // 名片本身也要响应 hover：鼠标从头像移进名片时不能关掉，否则里面的链接点不到。
          onMouseEnter={clearTimers}
          onMouseLeave={handleLeave}
          className={`absolute left-0 z-40 block w-72 cursor-default ${
            flipUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          <span className="block rounded-2xl border border-line bg-surface p-4 shadow-xl">
            {card === undefined ? (
              <CardSkeleton />
            ) : card === null ? (
              <span className="block text-sm text-muted">{t("notFound")}</span>
            ) : (
              <CardBody card={card} />
            )}
          </span>
        </span>
      )}
    </span>
  );
}

function CardSkeleton() {
  return (
    <span className="flex animate-pulse items-center gap-3">
      <span className="h-12 w-12 shrink-0 rounded-full bg-surface-2" />
      <span className="flex flex-col gap-1.5">
        <span className="block h-3.5 w-24 rounded bg-surface-2" />
        <span className="block h-3 w-16 rounded bg-surface-2" />
      </span>
    </span>
  );
}

function CardBody({ card }: { card: UserCard }) {
  const t = useTranslations("userCard");
  const locale = useLocale();
  const format = useFormatter();
  const name = card.displayName || card.username;
  const showRole = card.role === "admin" || card.role === "member";
  const badges = card.badgeKeys
    .map((key) => badgeInfo(key, locale))
    .filter((badge): badge is NonNullable<typeof badge> => badge !== null);

  return (
    <span className="block">
      <Link href={`/u/${card.username}`} className="flex items-center gap-3">
        <Avatar
          src={card.avatarUrl}
          name={name}
          className="h-12 w-12 rounded-full bg-brand-soft font-display text-base font-bold text-brand-ink"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{name}</span>
            <LevelBadge level={card.level} size="xs" />
            {showRole && <RoleTag role={card.role} />}
            {card.tags.map((tag) => (
              <span key={tag} title={userTagLabel(tag, locale)} className="text-xs leading-none">
                {USER_TAG_INFO[tag].icon}
              </span>
            ))}
          </span>
          {/* @提及用的是用户名而不是昵称，所以这里要显眼地把用户名摆出来。 */}
          <span className="mt-0.5 block truncate font-mono text-xs text-brand-ink">@{card.username}</span>
        </span>
      </Link>

      {card.bio && <span className="mt-2.5 line-clamp-3 block text-xs leading-5 text-muted">{card.bio}</span>}

      {badges.length > 0 && (
        <span className="mt-2.5 flex flex-wrap gap-1">
          {badges.map((badge, i) => (
            <span
              key={i}
              title={`${badge.name} · ${badge.description}`}
              className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted"
            >
              <span className="leading-none">{badge.icon}</span>
              {badge.name}
            </span>
          ))}
        </span>
      )}

      <span className="mt-2.5 flex items-center gap-3 border-t border-line pt-2.5 font-mono text-[11px] text-faint">
        {/* 别人的名片上只给经验总量，不显示"还差多少升级"——那是本人才看得到的信息。 */}
        <span>{card.xp.toLocaleString()} XP</span>
        <span>{t("submissionCount", { count: card.submissionCount })}</span>
        <span>{t("joinedAt", { date: format.dateTime(new Date(card.joinedAt), { dateStyle: "medium" }) })}</span>
      </span>
    </span>
  );
}
