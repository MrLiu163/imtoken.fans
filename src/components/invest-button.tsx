"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { castSimulatedInvestment } from "@/app/actions/investments";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function InvestButton({
  submissionId,
  isLoggedIn,
  initialTotal,
}: {
  submissionId: string;
  isLoggedIn: boolean;
  initialTotal: number;
}) {
  const t = useTranslations("invest");
  const tc = useTranslations("common");
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [total, setTotal] = useState(initialTotal);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("100");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    setError(null);
    startTransition(async () => {
      const result = await castSimulatedInvestment(submissionId, parsed, pathname);
      if (result.error) {
        setError(result.error);
        return;
      }
      setTotal((t) => t + parsed);
      setOpen(false);
    });
  }

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface-2 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{t("title")}</p>
          <p className="text-sm text-muted">{t("currentTotal", { total: usd.format(total) })}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={!isLoggedIn}
          className="shrink-0 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
          title={isLoggedIn ? undefined : t("signInTitle")}
        >
          {isLoggedIn ? t("button") : t("signInToInvest")}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-2">
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? tc("submitting") : t("confirm")}
          </button>
        </form>
      )}

      {error && <p className="mt-2 text-xs text-risk">{error}</p>}

      <p className="mt-3 font-mono text-xs text-faint">{t("disclaimer")}</p>
    </div>
  );
}
