"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { toggleVote, type VoteType } from "@/app/actions/votes";

export function VoteButtons({
  submissionId,
  isLoggedIn,
  initialVotesPaid,
  initialVotesCreative,
  initialVoted,
}: {
  submissionId: string;
  isLoggedIn: boolean;
  initialVotesPaid: number;
  initialVotesCreative: number;
  initialVoted: { paid: boolean; creative: boolean };
}) {
  const t = useTranslations("vote");
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [votesPaid, setVotesPaid] = useState(initialVotesPaid);
  const [votesCreative, setVotesCreative] = useState(initialVotesCreative);
  const [voted, setVoted] = useState(initialVoted);
  const [error, setError] = useState<string | null>(null);

  function handleToggle(voteType: VoteType) {
    setError(null);
    startTransition(async () => {
      const result = await toggleVote(submissionId, voteType, pathname);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      const delta = result.voted ? 1 : -1;
      if (voteType === "paid") {
        setVotesPaid((v) => v + delta);
        setVoted((prev) => ({ ...prev, paid: result.voted }));
      } else {
        setVotesCreative((v) => v + delta);
        setVoted((prev) => ({ ...prev, creative: result.voted }));
      }
    });
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <VoteBox
        label={`💵 ${t("paidLabel")}`}
        description={t("paidDescription")}
        count={votesPaid}
        active={voted.paid}
        disabled={isPending || !isLoggedIn}
        buttonLabel={
          isLoggedIn ? (voted.paid ? t("votedClickToCancel") : t("vote")) : t("signInToVote")
        }
        onClick={() => handleToggle("paid")}
      />
      <VoteBox
        label={`💡 ${t("creativeLabel")}`}
        description={t("creativeDescription")}
        count={votesCreative}
        active={voted.creative}
        disabled={isPending || !isLoggedIn}
        buttonLabel={
          isLoggedIn ? (voted.creative ? t("votedClickToCancel") : t("vote")) : t("signInToVote")
        }
        onClick={() => handleToggle("creative")}
      />
      {error && <p className="text-xs text-risk sm:col-span-2">{error}</p>}
    </div>
  );
}

function VoteBox({
  label,
  description,
  count,
  active,
  disabled,
  buttonLabel,
  onClick,
}: {
  label: ReactNode;
  description: string;
  count: number;
  active: boolean;
  disabled: boolean;
  buttonLabel: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-ink">{label}</p>
        <span className="font-mono text-sm text-muted">{count}</span>
      </div>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`mt-4 w-full rounded-full py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          active
            ? "border border-brand bg-brand-soft text-brand-ink"
            : "border border-line text-muted hover:border-brand hover:text-brand-ink"
        }`}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
