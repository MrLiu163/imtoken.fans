"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SubmissionExplorer } from "@/components/submission-explorer";
import type { SubmissionCard } from "@/lib/types";

const TABS = [
  { id: "product", emoji: "🏆", labelKey: "productsTab" },
  { id: "idea", emoji: "🏆", labelKey: "ideasTab" },
] as const;

export function LeaderboardSections({
  products,
  ideas,
}: {
  products: SubmissionCard[];
  ideas: SubmissionCard[];
}) {
  const t = useTranslations("leaderboard");
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("product");

  const tabs = (
    <div className="flex shrink-0 gap-2">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActive(tab.id)}
          className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            active === tab.id
              ? "bg-brand text-white"
              : "border border-line text-muted hover:border-brand hover:text-brand-ink"
          }`}
        >
          <span className="mr-1.5">{tab.emoji}</span>
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );

  return active === "product" ? (
    <SubmissionExplorer submissions={products} rowVariant="ranked" headerLeft={tabs} />
  ) : (
    <SubmissionExplorer submissions={ideas} rowVariant="ranked" headerLeft={tabs} />
  );
}
