"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { updateSubmissionStats } from "@/app/actions/submissions";

export function SubmissionStatsForm({
  submissionId,
  initialStatsUsers,
  initialStatsDau,
}: {
  submissionId: string;
  initialStatsUsers: number | null;
  initialStatsDau: number | null;
}) {
  const t = useTranslations("stats");
  const tc = useTranslations("common");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [statsUsers, setStatsUsers] = useState(String(initialStatsUsers ?? ""));
  const [statsDau, setStatsDau] = useState(String(initialStatsDau ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSubmissionStats(submissionId, {
        statsUsers: Number(statsUsers) || 0,
        statsDau: Number(statsDau) || 0,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-line px-4 py-1.5 text-xs font-medium text-muted transition-colors hover:border-brand hover:text-brand-ink"
      >
        {t("update")}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-ink">{t("users")}</span>
        <input
          type="number"
          min="0"
          value={statsUsers}
          onChange={(e) => setStatsUsers(e.target.value)}
          className="w-28 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-ink">{t("dau")}</span>
        <input
          type="number"
          min="0"
          value={statsDau}
          onChange={(e) => setStatsDau(e.target.value)}
          className="w-28 rounded-lg border border-line bg-bg px-2 py-1.5 text-sm text-ink focus:border-brand focus:outline-none"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? tc("saving") : tc("save")}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-brand"
      >
        {tc("cancel")}
      </button>
      {error && <p className="w-full text-xs text-risk">{error}</p>}
      {success && <p className="w-full text-xs text-good">{tc("saved")}</p>}
    </form>
  );
}
