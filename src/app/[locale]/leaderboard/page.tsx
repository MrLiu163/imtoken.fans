import { LeaderboardSections } from "@/components/leaderboard-sections";
import { getPublishedSubmissionCards } from "@/lib/submissions";

export default async function LeaderboardPage() {
  const submissions = await getPublishedSubmissionCards();
  const products = submissions.filter((s) => s.type === "product");
  const ideas = submissions.filter((s) => s.type === "idea");

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
      <div className="max-w-3xl">
        <LeaderboardSections products={products} ideas={ideas} />
      </div>
    </div>
  );
}
