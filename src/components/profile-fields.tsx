"use client";

import { useState, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { uploadSubmissionMedia } from "@/app/actions/media";
import { getSubmissionMediaUrl } from "@/lib/media";
import { Avatar } from "@/components/avatar";
import { EXPERTISE_OPTIONS, MAX_EXPERTISE } from "@/lib/expertise";

export const BIO_MAX_LENGTH = 200;
export const DISPLAY_NAME_MAX_LENGTH = 30;

export interface ProfileFieldsValue {
  displayName: string;
  username: string;
  bio: string;
  expertise: string[];
  avatarPath: string | null;
  avatarPreview: string | null;
}

// 引导页和「编辑资料」弹窗共用同一组字段，避免两处校验/文案各写一遍走偏。
export function ProfileFields({
  value,
  onChange,
  disabled,
}: {
  value: ProfileFieldsValue;
  onChange: (next: ProfileFieldsValue) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("profileFields");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const result = await uploadSubmissionMedia(formData);
    setUploading(false);
    if ("error" in result) {
      setUploadError(result.error);
      return;
    }
    onChange({ ...value, avatarPath: result.path, avatarPreview: getSubmissionMediaUrl(result.path) });
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
      <div className="flex shrink-0 flex-col items-center gap-2">
        <Avatar
          src={value.avatarPreview}
          name={value.displayName || value.username}
          className="h-24 w-24 rounded-full bg-surface-2 font-display text-2xl font-bold text-muted"
        />
        <label className="cursor-pointer text-xs font-medium text-brand-ink hover:underline">
          {uploading ? tc("uploading") : t("changeAvatar")}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={handleAvatarChange}
          />
        </label>
        <p className="text-center text-[11px] text-faint">{t("avatarHint")}</p>
        {uploadError && <p className="text-center text-[11px] text-risk">{uploadError}</p>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Field label={t("displayName")} hint={t("displayNameHint")}>
          <input
            value={value.displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, displayName: e.target.value })}
            placeholder={t("displayNamePlaceholder")}
            className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none disabled:opacity-70"
          />
        </Field>

        <Field label={t("username")} hint={t("usernameHint")}>
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 focus-within:border-brand">
            <span className="shrink-0 font-mono text-sm text-faint">@</span>
            <input
              value={value.username}
              maxLength={20}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, username: e.target.value })}
              placeholder="hongbo_liu"
              className="w-full min-w-0 bg-transparent py-2 font-mono text-sm text-ink placeholder:text-faint focus:outline-none disabled:opacity-70"
            />
          </div>
        </Field>

        <Field label={t("bio")} hint={`${value.bio.length}/${BIO_MAX_LENGTH}`}>
          <textarea
            value={value.bio}
            maxLength={BIO_MAX_LENGTH}
            rows={3}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, bio: e.target.value })}
            placeholder={t("bioPlaceholder")}
            className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink placeholder:text-faint focus:border-brand focus:outline-none disabled:opacity-70"
          />
        </Field>

        <Field label={t("expertise")} hint={t("expertiseHint", { max: MAX_EXPERTISE })}>
          <div className="flex flex-wrap gap-2">
            {EXPERTISE_OPTIONS.map((option) => {
              const active = value.expertise.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled || (!active && value.expertise.length >= MAX_EXPERTISE)}
                  onClick={() =>
                    onChange({
                      ...value,
                      expertise: active
                        ? value.expertise.filter((id) => id !== option.id)
                        : [...value.expertise, option.id],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    active
                      ? "border-brand bg-brand-soft text-brand-ink"
                      : "border-line text-muted hover:border-brand hover:text-brand-ink"
                  }`}
                >
                  {locale === "en" ? option.en : option.zh}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{label}</span>
        {hint && <span className="text-[11px] text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}
