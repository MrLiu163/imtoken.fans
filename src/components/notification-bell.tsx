"use client";

import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearAllNotifications, markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { badgeInfo, type NotificationDetail, type NotificationItem } from "@/lib/types";
import { Avatar } from "@/components/avatar";
import { LevelBadge } from "@/components/level-badge";
import { levelTierName } from "@/lib/level";

type NotificationT = ReturnType<typeof useTranslations<"notifications">>;

const POLL_INTERVAL_MS = 30_000;

// 「谁 + 做了什么」模板，只有这两种有触发人。
// 其余类型走下面 systemNotification() 的「图标 + 一句话」渲染。
const TYPE_TEXT_KEY: Partial<Record<NotificationItem["type"], "reply" | "mention">> = {
  reply: "reply",
  mention: "mention",
};

// 系统通知（没有触发人的那几种）：各自给一个图标、一句话和点进去的落地页。
// 集中在这里而不是散成一堆 if：以后加新类型只用在这个 switch 里补一条。
function systemNotification(
  type: NotificationItem["type"],
  detail: NotificationDetail | null,
  t: NotificationT,
  locale: string
): { icon: ReactNode; text: ReactNode; href: string } | null {
  switch (type) {
    case "level_up": {
      const level = detail?.level ?? 0;
      return {
        icon: <LevelBadge level={level} size="sm" className="mt-0.5" />,
        text: (
          <>
            <span className="font-semibold">{t("levelUpStrong")}</span>{" "}
            {t("levelUpBody", { level, tier: levelTierName(level, locale) })}
          </>
        ),
        href: "/profile",
      };
    }
    case "lottery_ticket": {
      const amount = detail?.amount ?? 0;
      const gained = amount > 0;
      return {
        icon: <SystemIcon emoji="🎟️" tone={gained ? "warn" : "muted"} />,
        text: (
          <>
            <span className="font-semibold">
              {gained
                ? t("ticketGained", { amount })
                : t("ticketRevoked", { amount: Math.abs(amount) })}
            </span>{" "}
            {detail?.source === "lottery_prize" ? t("ticketFromLottery") : t("ticketFromAdmin")}
            {typeof detail?.balance === "number" && t("ticketBalance", { balance: detail.balance })}
          </>
        ),
        href: "/activities",
      };
    }
    case "badge": {
      const badge = detail?.badge_key ? badgeInfo(detail.badge_key, locale) : null;
      return {
        icon: <SystemIcon emoji={badge?.icon ?? "🏅"} tone="brand" />,
        text: (
          <>
            <span className="font-semibold">{t("badgeStrong")}</span>{" "}
            {badge?.name ?? detail?.badge_key ?? t("badgeFallback")}
          </>
        ),
        href: "/profile",
      };
    }
    case "xp_adjust": {
      const amount = detail?.amount ?? 0;
      return {
        icon: <SystemIcon emoji={amount > 0 ? "✨" : "⚠️"} tone={amount > 0 ? "good" : "muted"} />,
        text: (
          <>
            <span className="font-semibold">
              {amount > 0
                ? t("xpAdded", { amount })
                : t("xpRemoved", { amount: Math.abs(amount) })}
            </span>
            {typeof detail?.xp === "number" && t("xpBalance", { xp: detail.xp.toLocaleString() })}
          </>
        ),
        href: "/profile",
      };
    }
    default:
      return null;
  }
}

function SystemIcon({ emoji, tone }: { emoji: string; tone: "brand" | "good" | "warn" | "muted" }) {
  const toneClass =
    tone === "good" ? "bg-good-soft" : tone === "warn" ? "bg-warn-soft" : tone === "brand" ? "bg-brand-soft" : "bg-surface-2";
  return (
    <span
      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base ${toneClass}`}
      aria-hidden
    >
      {emoji}
    </span>
  );
}

interface RawNotificationRow {
  id: string;
  type: NotificationItem["type"];
  read_at: string | null;
  created_at: string;
  submission_id: string | null;
  comment_id: string | null;
  detail: NotificationDetail | null;
  actor: { username: string | null; avatar_url: string | null } | null;
  submission: { title: string; type: "product" | "idea" } | null;
  comment: { body: string } | null;
}

export function NotificationBell() {
  const t = useTranslations("notifications");
  const tc = useTranslations("common");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, type, read_at, created_at, submission_id, comment_id, detail, actor:profiles!actor_id(username, avatar_url), submission:submissions(title, type), comment:comments(body)"
      )
      .order("created_at", { ascending: false })
      .limit(20);

    const rows = (data ?? []) as unknown as RawNotificationRow[];
    setItems(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        read_at: row.read_at,
        created_at: row.created_at,
        actor_username: row.actor?.username ?? null,
        actor_avatar_url: row.actor?.avatar_url ?? null,
        submission_id: row.submission_id,
        submission_type: row.submission?.type ?? null,
        submission_title: row.submission?.title ?? null,
        comment_id: row.comment_id,
        comment_preview: row.comment?.body ? row.comment.body.slice(0, 60) : null,
        detail: row.detail ?? null,
      }))
    );
  }, []);

  useEffect(() => {
    // 拉取通知 + 轮询是外部数据同步，不是从 props/state 派生的值，这里的 setState 就是预期行为。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  function handleClickItem(item: NotificationItem) {
    setOpen(false);
    if (!item.read_at) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      startTransition(() => {
        markNotificationRead(item.id);
      });
    }
    // 系统通知不挂在任何内容上，各自有自己的落地页（等级去个人主页、券去活动页……）。
    const system = systemNotification(item.type, item.detail, t, locale);
    if (system) {
      router.push(system.href);
      return;
    }
    if (item.submission_id && item.submission_type) {
      const base = item.submission_type === "product" ? "/products" : "/ideas";
      router.push(`${base}/${item.submission_id}${item.comment_id ? `#comment-${item.comment_id}` : ""}`);
    }
  }

  function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    startTransition(() => {
      markAllNotificationsRead();
    });
  }

  function handleClearAll() {
    if (!window.confirm(t("clearConfirm"))) return;
    setItems([]);
    startTransition(() => {
      clearAllNotifications();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("aria")}
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk px-1 font-mono text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-line bg-surface shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
            <p className="text-sm font-semibold text-ink">{t("title")}</p>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleMarkAllRead}
                  className="text-xs text-brand-ink transition-colors hover:underline disabled:opacity-60"
                >
                  {t("markAllRead")}
                </button>
              )}
              {items.length > 0 && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleClearAll}
                  aria-label={t("clearAll")}
                  title={t("clearAll")}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted transition-colors hover:bg-risk-soft hover:text-risk disabled:opacity-60"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">{t("empty")}</p>
            ) : (
              items.map((item) => {
                const system = systemNotification(item.type, item.detail, t, locale);
                const typeKey = TYPE_TEXT_KEY[item.type];
                return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClickItem(item)}
                  className={`flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-2 ${
                    item.read_at ? "" : "bg-brand-soft/40"
                  }`}
                >
                  {system ? (
                    system.icon
                  ) : (
                    <Avatar
                      src={item.actor_avatar_url}
                      name={item.actor_username}
                      className="h-8 w-8 rounded-full bg-surface-2 font-display text-xs font-bold text-muted"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink">
                      {system?.text ?? (
                        <>
                          <span className="font-semibold">{item.actor_username ?? tc("deletedUser")}</span>{" "}
                          {typeKey ? t(typeKey) : null}
                        </>
                      )}
                    </p>
                    {item.submission_title && (
                      <p className="truncate text-xs text-muted">「{item.submission_title}」</p>
                    )}
                    {item.comment_preview && <p className="truncate text-xs text-faint">{item.comment_preview}</p>}
                    <p className="mt-0.5 font-mono text-[10px] text-faint">
                      {format.dateTime(new Date(item.created_at), {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  {!item.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" aria-hidden />}
                </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
