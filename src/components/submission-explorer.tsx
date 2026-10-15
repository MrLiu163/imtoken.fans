"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { SubmissionListRow } from "@/components/submission-list-row";
import { Modal } from "@/components/modal";
import { getTagLabel } from "@/lib/tag-taxonomy";
import type { SubmissionCard, SubmissionType } from "@/lib/types";

// label 不写死在这里，只留 id——文案统一从 messages/*.json 的 explorer.* 取，
// 换语言时筛选面板跟着变（见 AGENTS.md 的「文案与 i18n」）。
type SortOption = { id: string; sort: (a: SubmissionCard, b: SubmissionCard) => number };
type TypeFilterValue = "all" | SubmissionType;

const DEFAULT_SORTS: SortOption[] = [
  { id: "hot", sort: (a, b) => b.votes_paid + b.votes_creative - (a.votes_paid + a.votes_creative) },
  { id: "invest", sort: (a, b) => b.sim_invest_usd - a.sim_invest_usd },
  { id: "creative", sort: (a, b) => b.votes_creative - a.votes_creative },
  { id: "paid", sort: (a, b) => b.votes_paid - a.votes_paid },
];

const DATE_PRESETS: { id: string; days: number | null }[] = [
  { id: "all", days: null },
  { id: "7d", days: 7 },
  { id: "30d", days: 30 },
  { id: "90d", days: 90 },
  { id: "365d", days: 365 },
];

const INVEST_PRESETS: { id: string; min: number }[] = [
  { id: "all", min: 0 },
  { id: "100", min: 100 },
  { id: "1000", min: 1000 },
  { id: "10000", min: 10000 },
  { id: "100000", min: 100000 },
];

export function SubmissionExplorer({
  submissions,
  sortOptions = DEFAULT_SORTS,
  showTypeFilter = false,
  rowVariant = "plain",
  headerLeft,
}: {
  submissions: SubmissionCard[];
  sortOptions?: SortOption[];
  showTypeFilter?: boolean;
  rowVariant?: "plain" | "ranked";
  headerLeft?: ReactNode;
}) {
  const t = useTranslations("explorer");
  const locale = useLocale();
  const [sortId, setSortId] = useState(sortOptions[0].id);
  const [typeFilter, setTypeFilter] = useState<TypeFilterValue>("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [investFilter, setInvestFilter] = useState("all");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of submissions) {
      for (const tag of s.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [submissions]);

  const filtered = useMemo(() => {
    const datePreset = DATE_PRESETS.find((d) => d.id === dateFilter);
    const investPreset = INVEST_PRESETS.find((i) => i.id === investFilter);
    const cutoff = datePreset?.days ? now - datePreset.days * 86_400_000 : null;

    return submissions.filter((s) => {
      if (showTypeFilter && typeFilter !== "all" && s.type !== typeFilter) return false;
      if (tagFilter !== "all" && !s.tags.includes(tagFilter)) return false;
      if (cutoff !== null && new Date(s.created_at).getTime() < cutoff) return false;
      if (investPreset && s.sim_invest_usd < investPreset.min) return false;
      return true;
    });
  }, [submissions, typeFilter, tagFilter, dateFilter, investFilter, showTypeFilter, now]);

  const sort = sortOptions.find((s) => s.id === sortId) ?? sortOptions[0];
  const sorted = useMemo(() => [...filtered].sort(sort.sort), [filtered, sort]);

  const activeFilterCount = [
    typeFilter !== "all",
    tagFilter !== "all",
    dateFilter !== "all",
    investFilter !== "all",
  ].filter(Boolean).length;

  function clearFilters() {
    setTypeFilter("all");
    setTagFilter("all");
    setDateFilter("all");
    setInvestFilter("all");
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {headerLeft ?? <div />}
        <div className="flex shrink-0 items-center gap-3">
          {activeFilterCount > 0 && (
            <button type="button" onClick={clearFilters} className="text-xs font-medium text-brand-ink hover:underline">
              {t("clearFilters")}
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterModalOpen(true)}
            className="relative flex h-9 items-center gap-1.5 rounded-full border border-brand/30 bg-brand-soft px-3.5 text-sm font-semibold text-brand-ink transition-colors hover:border-brand hover:bg-brand/15"
          >
            <FilterIcon />
            {t("filter")}
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <Modal open={filterModalOpen} onClose={() => setFilterModalOpen(false)} title={t("filter")}>
        <div className="flex flex-col gap-4">
          {sortOptions.length > 1 && (
            <FilterField label={t("sortLabel")}>
              <Select
                value={sortId}
                onChange={setSortId}
                options={sortOptions.map((o) => ({ value: o.id, label: t(`sort.${o.id}`) }))}
              />
            </FilterField>
          )}
          {showTypeFilter && (
            <FilterField label={t("typeLabel")}>
              <Select
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as TypeFilterValue)}
                options={[
                  { value: "all", label: t("type.all") },
                  { value: "product", label: t("type.product") },
                  { value: "idea", label: t("type.idea") },
                ]}
              />
            </FilterField>
          )}
          <FilterField label={t("tagLabel")}>
            <Select
              value={tagFilter}
              onChange={setTagFilter}
              options={[
                { value: "all", label: t("tag.all") },
                ...tags.map((tag) => ({ value: tag, label: getTagLabel(tag, locale) })),
              ]}
            />
          </FilterField>
          <FilterField label={t("dateLabel")}>
            <Select
              value={dateFilter}
              onChange={setDateFilter}
              options={DATE_PRESETS.map((d) => ({ value: d.id, label: t(`date.${d.id}`) }))}
            />
          </FilterField>
          <FilterField label={t("investLabel")}>
            <Select
              value={investFilter}
              onChange={setInvestFilter}
              options={INVEST_PRESETS.map((i) => ({ value: i.id, label: t(`invest.${i.id}`) }))}
            />
          </FilterField>

          <div className="mt-2 flex justify-end gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
              >
                {t("clearFilters")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterModalOpen(false)}
              className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
            >
              {t("done")}
            </button>
          </div>
        </div>
      </Modal>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
          {t("empty")}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-line">
          {sorted.map((submission, i) => (
            <SubmissionListRow
              key={submission.id}
              submission={submission}
              rank={i + 1}
              variant={rowVariant}
              showTypeBadge={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16l-6 8v6l-4-2v-4L4 5Z" />
    </svg>
  );
}
