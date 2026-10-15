"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/components/modal";
import { TAG_TAXONOMY, ALL_TAGS, type TagOption } from "@/lib/tag-taxonomy";

export function TagPicker({
  value,
  onChange,
  max = 10,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
}) {
  const locale = useLocale();
  const t = useTranslations("tagPicker");
  const [open, setOpen] = useState(false);

  function remove(id: string) {
    onChange(value.filter((v) => v !== id));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {value.map((id) => {
          const option = ALL_TAGS.find((o) => o.id === id);
          const label = option ? (locale === "zh" ? option.zh : option.en) : id;
          return (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand-ink"
            >
              {label}
              <button
                type="button"
                onClick={() => remove(id)}
                aria-label={t("remove", { label })}
                className="text-brand-ink/60 hover:text-brand-ink"
              >
                ×
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-dashed border-line px-3 py-1 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
        >
          + {t("add")}
        </button>
      </div>
      <p className="mt-1.5 font-mono text-[11px] text-faint">
        {value.length}/{max}
      </p>

      <TagPickerModal
        open={open}
        onClose={() => setOpen(false)}
        value={value}
        onChange={onChange}
        max={max}
      />
    </div>
  );
}

function TagPickerModal({
  open,
  onClose,
  value,
  onChange,
  max,
}: {
  open: boolean;
  onClose: () => void;
  value: string[];
  onChange: (ids: string[]) => void;
  max: number;
}) {
  const locale = useLocale();
  const t = useTranslations("tagPicker");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(TAG_TAXONOMY[0].id);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return ALL_TAGS.filter(
      (option) => option.zh.toLowerCase().includes(q) || option.en.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [query]);

  function toggle(option: TagOption) {
    const active = value.includes(option.id);
    if (active) {
      onChange(value.filter((v) => v !== option.id));
    } else {
      if (value.length >= max) return;
      onChange([...value, option.id]);
    }
  }

  const atMax = value.length >= max;

  return (
    <Modal open={open} onClose={onClose} title={t("title")} widthClassName="max-w-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 focus-within:border-brand">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-faint focus:outline-none"
          />
        </div>

        <p className="font-mono text-[11px] text-faint">
          {t("selectedCount", { count: value.length, max })}
        </p>

        {/* 内容区高度写死（h-64/h-80，不是 max-h）：切换左边的类别时右边标签多少不一，
            用 max-h 的话弹窗会跟着一会儿变高一会儿变矮，很晃眼。滚动交给里面的容器。 */}
        {searchResults ? (
          <div className="flex h-64 flex-wrap content-start gap-2 overflow-y-auto sm:h-80">
            {searchResults.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{t("noMatches")}</p>
            ) : (
              searchResults.map((option) => (
                <TagChip
                  key={option.id}
                  option={option}
                  locale={locale}
                  active={value.includes(option.id)}
                  disabled={!value.includes(option.id) && atMax}
                  onClick={() => toggle(option)}
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex h-64 gap-4 sm:h-80">
            <div className="flex w-32 shrink-0 flex-col gap-1 overflow-y-auto">
              {TAG_TAXONOMY.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setActiveCategory(category.id)}
                  className={`rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    activeCategory === category.id
                      ? "bg-brand-soft text-brand-ink"
                      : "text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  {locale === "zh" ? category.zh : category.en}
                </button>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto">
              {TAG_TAXONOMY.find((c) => c.id === activeCategory)?.groups.map((group) => (
                <div key={group.id}>
                  <p className="mb-1.5 text-xs font-semibold text-ink">
                    {locale === "zh" ? group.zh : group.en}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.tags.map((option) => (
                      <TagChip
                        key={option.id}
                        option={option}
                        locale={locale}
                        active={value.includes(option.id)}
                        disabled={!value.includes(option.id) && atMax}
                        onClick={() => toggle(option)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
          >
            {t("done")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TagChip({
  option,
  locale,
  active,
  disabled,
  onClick,
}: {
  option: TagOption;
  locale: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-brand bg-brand-soft text-brand-ink"
          : "border-line text-muted hover:border-brand hover:text-brand-ink"
      }`}
    >
      {locale === "zh" ? option.zh : option.en}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-faint">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
