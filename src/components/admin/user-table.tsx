"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setMemberPermissions, setUserBadge, setUserRole, setUserTag, muteUser } from "@/app/admin/actions";
import { adjustUserXp, grantLotteryTickets, setUserLevel } from "@/app/admin/campaign-actions";
import { EmptyState } from "@/components/admin/ui";
import { LevelBadge } from "@/components/level-badge";
import { MAX_LEVEL, levelTier } from "@/lib/level";
import type { AdminUserRow } from "@/lib/admin-data";
import {
  BADGE_INFO,
  GRANTABLE_BADGE_KEYS,
  MUTE_PRESETS,
  PERMISSION_INFO,
  PERMISSION_KEYS,
  ROLE_ADMIN_LABEL,
  USER_TAG_INFO,
  type MuteDuration,
  type PermissionKey,
  type UserRole,
  type UserTagKey,
} from "@/lib/types";

const ROLES: UserRole[] = ["user", "member", "admin"];
const TAG_KEYS = Object.keys(USER_TAG_INFO) as UserTagKey[];

const ROLE_PILL: Record<UserRole, string> = {
  admin: "bg-brand text-white",
  member: "bg-brand-soft text-brand-ink",
  user: "border border-line text-muted",
};

// 永久禁言存的是 9999 年（PERMANENT_MUTE_UNTIL），显示成日期没意义，单独判一下。
function muteLabel(mutedUntil: string): string {
  const date = new Date(mutedUntil);
  if (date.getUTCFullYear() >= 9999) return "永久禁言";
  return `禁言至 ${date.toLocaleString("zh-CN")}`;
}

export function UserTable({
  users: initialUsers,
  viewerId,
  viewerIsAdmin,
  viewerCanManageTags,
  viewerCanGrantBadges,
  viewerCanMuteUsers,
  viewerCanManageCampaigns,
}: {
  users: AdminUserRow[];
  viewerId: string;
  viewerIsAdmin: boolean;
  viewerCanManageTags: boolean;
  viewerCanGrantBadges: boolean;
  viewerCanMuteUsers: boolean;
  /** manage_campaigns：能手动补经验 / 直接设等级（冷启动和事后补偿用） */
  viewerCanManageCampaigns: boolean;
}) {
  const router = useRouter();
  // 和内容列表同样的理由（见 submission-table.tsx）：服务端分页/搜索会换掉整份数据，
  // 所以本地只存「改过的那几行」的补丁，不整份接管。
  const [patches, setPatches] = useState<Record<string, Partial<AdminUserRow>>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const users = initialUsers.map((u) => (patches[u.id] ? { ...u, ...patches[u.id] } : u));

  function patch(userId: string, next: Partial<AdminUserRow>) {
    setPatches((prev) => ({ ...prev, [userId]: { ...prev[userId], ...next } }));
  }

  // 乐观更新 + 失败回滚：所有开关都走这一条路径，省掉每个 handler 各写一遍。
  function optimistic(
    user: AdminUserRow,
    next: Partial<AdminUserRow>,
    task: () => Promise<{ error?: string }>
  ) {
    setError(null);
    const rollback = Object.fromEntries(
      Object.keys(next).map((key) => [key, user[key as keyof AdminUserRow]])
    ) as Partial<AdminUserRow>;
    patch(user.id, next);
    startTransition(async () => {
      const result = await task();
      if (result.error) {
        patch(user.id, rollback);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleRoleChange(user: AdminUserRow, role: UserRole) {
    optimistic(user, { role }, () => setUserRole(user.id, role));
  }

  function handlePermissionToggle(user: AdminUserRow, key: PermissionKey) {
    const permissions = { ...user.permissions, [key]: !user.permissions[key] };
    optimistic(user, { permissions }, () => setMemberPermissions(user.id, permissions));
  }

  function handleTagToggle(user: AdminUserRow, tagKey: UserTagKey) {
    const on = !user.tags.includes(tagKey);
    const tags = on ? [...user.tags, tagKey] : user.tags.filter((t) => t !== tagKey);
    optimistic(user, { tags }, () => setUserTag(user.id, tagKey, on));
  }

  function handleBadge(user: AdminUserRow, badgeKey: string, on: boolean) {
    const badges = on ? [...user.badges, badgeKey] : user.badges.filter((b) => b !== badgeKey);
    const granted = on
      ? [...user.granted_badges, badgeKey]
      : user.granted_badges.filter((b) => b !== badgeKey);
    optimistic(user, { badges, granted_badges: granted }, () => setUserBadge(user.id, badgeKey, on));
  }

  function handleMute(user: AdminUserRow, duration: MuteDuration | null) {
    optimistic(user, {}, async () => {
      const result = await muteUser(user.id, duration);
      // 禁言到期时间是服务端算的，成功之后本地按同样的规则补一份，避免等一次往返才变灰。
      if (!result.error) {
        patch(user.id, {
          muted_until:
            duration === null
              ? null
              : duration === "permanent"
                ? "9999-12-31T00:00:00.000Z"
                : new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
      return result;
    });
  }

  if (users.length === 0) return <EmptyState>没有符合条件的用户。</EmptyState>;

  const canExpand =
    viewerIsAdmin ||
    viewerCanManageTags ||
    viewerCanGrantBadges ||
    viewerCanMuteUsers ||
    viewerCanManageCampaigns;

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-risk">{error}</p>}

      {users.map((user) => {
        const isMuted = Boolean(user.muted_until && new Date(user.muted_until) > new Date());
        const expanded = expandedId === user.id;
        const isSelf = user.id === viewerId;
        const grantableRemaining = GRANTABLE_BADGE_KEYS.filter((key) => !user.badges.includes(key));

        return (
          <div key={user.id} className="rounded-xl bg-surface-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {user.username ? (
                    <Link
                      href={`/u/${user.username}`}
                      className="truncate text-sm font-medium text-ink transition-colors hover:text-brand-ink"
                    >
                      {user.display_name ?? user.username}
                    </Link>
                  ) : (
                    <span className="truncate font-mono text-sm text-muted">{user.id.slice(0, 8)}</span>
                  )}
                  {isSelf && <span className="font-mono text-[10px] text-faint">（你）</span>}

                  <LevelBadge level={user.level} size="xs" />
                  {user.tags.map((tag) => (
                    <span key={tag} title={USER_TAG_INFO[tag].label} className="text-xs">
                      {USER_TAG_INFO[tag].icon}
                    </span>
                  ))}
                  {user.badges.map((badgeKey) =>
                    BADGE_INFO[badgeKey] ? (
                      <span key={badgeKey} title={BADGE_INFO[badgeKey].name} className="text-xs">
                        {BADGE_INFO[badgeKey].icon}
                      </span>
                    ) : null
                  )}
                  {isMuted && (
                    <span
                      title={muteLabel(user.muted_until as string)}
                      className="rounded-full bg-risk-soft px-2 py-0.5 font-mono text-[10px] text-risk"
                    >
                      已禁言
                    </span>
                  )}
                </div>
                <p className="font-mono text-[11px] text-faint">
                  {user.username ? `@${user.username} · ` : ""}
                  {user.xp.toLocaleString()} XP · 🎟️ {user.lottery_tickets} · 注册于{" "}
                  {new Date(user.created_at).toLocaleDateString("zh-CN")}
                  {user.wallet_address ? ` · ${user.wallet_address.slice(0, 6)}…${user.wallet_address.slice(-4)}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {viewerIsAdmin && !isSelf ? (
                  <select
                    value={user.role}
                    disabled={isPending}
                    onChange={(event) => handleRoleChange(user, event.target.value as UserRole)}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink"
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {ROLE_ADMIN_LABEL[role]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ROLE_PILL[user.role]}`}>
                    {ROLE_ADMIN_LABEL[user.role]}
                  </span>
                )}

                {canExpand && (
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : user.id)}
                    className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
                  >
                    {expanded ? "收起" : "管理"}
                  </button>
                )}
              </div>
            </div>

            {expanded && (
              <div className="mt-3 flex flex-col gap-4 border-t border-line pt-3">
                {viewerIsAdmin && (
                  <Section
                    label="权限"
                    hint={
                      user.role === "member"
                        ? "只对 Manager 生效；Admin 默认拥有全部权限"
                        : "先把角色改成 Manager 才能逐项授权（Admin 默认拥有全部权限）"
                    }
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {PERMISSION_KEYS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          disabled={isPending || user.role !== "member"}
                          title={PERMISSION_INFO[key].description}
                          onClick={() => handlePermissionToggle(user, key)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            user.role === "admin" || user.permissions[key]
                              ? "bg-brand text-white"
                              : "border border-line text-muted hover:border-brand hover:text-brand-ink"
                          }`}
                        >
                          {PERMISSION_INFO[key].label}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {viewerCanGrantBadges && (
                  <Section label="徽章" hint="下拉菜单里的是可颁发的荣誉徽章；自动成就徽章不能手动撤销">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {user.granted_badges.map((badgeKey) => (
                        <button
                          key={badgeKey}
                          type="button"
                          disabled={isPending}
                          title={`撤销「${BADGE_INFO[badgeKey]?.name ?? badgeKey}」`}
                          onClick={() => handleBadge(user, badgeKey, false)}
                          className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-60"
                        >
                          {BADGE_INFO[badgeKey]?.icon} {BADGE_INFO[badgeKey]?.name ?? badgeKey} ✕
                        </button>
                      ))}

                      <BadgeGrantSelect
                        options={grantableRemaining}
                        disabled={isPending}
                        onGrant={(badgeKey) => handleBadge(user, badgeKey, true)}
                      />
                    </div>
                  </Section>
                )}

                {viewerCanManageTags && (
                  <Section label="标签" hint="VIP / 官方认证 / 黑名单，会显示在用户名旁边">
                    <div className="flex flex-wrap gap-1.5">
                      {TAG_KEYS.map((tagKey) => (
                        <button
                          key={tagKey}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleTagToggle(user, tagKey)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${
                            user.tags.includes(tagKey)
                              ? "bg-brand text-white"
                              : "border border-line text-muted hover:border-brand hover:text-brand-ink"
                          }`}
                        >
                          {USER_TAG_INFO[tagKey].icon} {USER_TAG_INFO[tagKey].label}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {viewerCanManageCampaigns && (
                  <Section
                    label="等级与经验"
                    hint={`当前 Lv${user.level}「${levelTier(user.level).name}」· ${user.xp.toLocaleString()} XP。补的分会进用户的经验明细，也会触发升级通知`}
                  >
                    <XpControls user={user} onChanged={(xp, level) => patch(user.id, { xp, level })} />
                  </Section>
                )}

                {viewerCanManageCampaigns && (
                  <Section
                    label="抽奖券"
                    hint={`当前 ${user.lottery_tickets} 张。抽奖是纯券制，没券就抽不了——冷启动和补偿都靠这里发`}
                  >
                    <TicketControls
                      user={user}
                      onChanged={(tickets) => patch(user.id, { lottery_tickets: tickets })}
                    />
                  </Section>
                )}

                {viewerCanMuteUsers && !isSelf && (
                  <Section label="禁言" hint={isMuted ? muteLabel(user.muted_until as string) : "禁言期间不能发表评论"}>
                    <div className="flex flex-wrap gap-1.5">
                      {MUTE_PRESETS.map((preset) => (
                        <button
                          key={String(preset.value)}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleMute(user, preset.value)}
                          className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-risk hover:text-risk disabled:opacity-60"
                        >
                          {preset.label}
                        </button>
                      ))}
                      {isMuted && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleMute(user, null)}
                          className="rounded-full bg-good px-2.5 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          解除禁言
                        </button>
                      )}
                    </div>
                  </Section>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 发放 / 收回抽奖券。券是抽奖的唯一门槛，而它只有两个来源：这里和九宫格里的券奖品，
// 后者要先有券才够得着——所以新站上线时必须先从这里发一批，否则没人抽得动。
function TicketControls({
  user,
  onChanged,
}: {
  user: AdminUserRow;
  onChanged: (tickets: number) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(5);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(delta: number) {
    setError(null);
    startTransition(async () => {
      const result = await grantLotteryTickets(user.id, delta);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.newBalance !== undefined) onChanged(result.newBalance);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={amount}
          min={1}
          max={10000}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1 text-sm text-ink"
        />
        <button
          type="button"
          disabled={isPending || amount <= 0}
          onClick={() => run(Math.abs(amount))}
          className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-40"
        >
          发放抽奖券
        </button>
        <button
          type="button"
          disabled={isPending || amount <= 0}
          onClick={() => run(-Math.abs(amount))}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-risk hover:text-risk disabled:opacity-40"
        >
          收回
        </button>
      </div>
      {error && <p className="text-xs text-risk">{error}</p>}
    </div>
  );
}

// 手动补经验 / 直接设等级。冷启动时站里没内容，谁都是 Lv0；
// 活动出问题漏发奖励时也要能补。两个操作都走 award_xp 流水，账目查得到。
function XpControls({
  user,
  onChanged,
}: {
  user: AdminUserRow;
  onChanged: (xp: number, level: number) => void;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(100);
  const [level, setLevel] = useState(user.level);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(task: () => Promise<{ error?: string; newXp?: number; newLevel?: number }>) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.newXp !== undefined && result.newLevel !== undefined) {
        onChanged(result.newXp, result.newLevel);
        setLevel(result.newLevel);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={amount}
          min={1}
          max={1000000}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="w-24 rounded-lg border border-line bg-surface px-2.5 py-1 text-sm text-ink"
        />
        <button
          type="button"
          disabled={isPending || amount <= 0}
          onClick={() => run(() => adjustUserXp(user.id, Math.abs(amount)))}
          className="rounded-full bg-good px-3 py-1 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          补经验
        </button>
        <button
          type="button"
          disabled={isPending || amount <= 0}
          onClick={() => run(() => adjustUserXp(user.id, -Math.abs(amount)))}
          className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-risk hover:text-risk disabled:opacity-40"
        >
          扣经验
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={level}
          disabled={isPending}
          onChange={(event) => setLevel(Number(event.target.value))}
          className="rounded-lg border border-line bg-surface px-2.5 py-1 text-sm text-ink"
        >
          {Array.from({ length: MAX_LEVEL + 1 }, (_, lv) => (
            <option key={lv} value={lv}>
              Lv{lv} · {levelTier(lv).name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || level === user.level}
          onClick={() => run(() => setUserLevel(user.id, level))}
          className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:opacity-40"
        >
          直接设为这一级
        </button>
        <span className="text-[11px] text-muted">
          「直接设为」= 把经验值补到这一级的门槛，不会让等级和经验对不上
        </span>
      </div>

      {error && <p className="text-xs text-risk">{error}</p>}
    </div>
  );
}

function Section({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">{label}</p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// 徽章种类会越加越多，平铺成一排按钮会撑爆行，所以做成「下拉选 + 颁发」。
function BadgeGrantSelect({
  options,
  disabled,
  onGrant,
}: {
  options: string[];
  disabled: boolean;
  onGrant: (badgeKey: string) => void;
}) {
  const [selected, setSelected] = useState("");

  if (options.length === 0) return <span className="text-xs text-muted">可颁发的徽章已全部授予</span>;

  return (
    <span className="flex items-center gap-1.5">
      <select
        value={selected}
        disabled={disabled}
        onChange={(event) => setSelected(event.target.value)}
        className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-ink"
      >
        <option value="">选择徽章…</option>
        {options.map((key) => (
          <option key={key} value={key}>
            {BADGE_INFO[key].icon} {BADGE_INFO[key].name} — {BADGE_INFO[key].description}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={disabled || !selected}
        onClick={() => {
          onGrant(selected);
          setSelected("");
        }}
        className="rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        颁发
      </button>
    </span>
  );
}
