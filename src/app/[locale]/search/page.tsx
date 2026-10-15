import { getTranslations } from "next-intl/server";
import { getPublishedSubmissionCards } from "@/lib/submissions";
import { parseSearchQuery, searchSubmissions } from "@/lib/search";
import { SearchBar } from "@/components/search-bar";
import { SubmissionListRow } from "@/components/submission-list-row";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("search");
  const { q = "" } = await searchParams;
  const query = q.trim();
  const parsed = parseSearchQuery(query);
  const results = query ? searchSubmissions(await getPublishedSubmissionCards(), query) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="mb-5 text-2xl font-extrabold text-ink">{t("title")}</h1>
        <div className="mb-8">
          <SearchBar initialQuery={query} variant="hero" />
        </div>

        {!query ? (
          <p className="text-muted">
            {t.rich("hint", {
              code: (chunks) => (
                <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{chunks}</code>
              ),
            })}
          </p>
        ) : (
          <>
            <p className="mb-6 text-muted">
              {parsed.username
                ? t("resultsForUser", { query: parsed.username, count: results.length })
                : t("resultsForQuery", { query, count: results.length })}
            </p>
            {results.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
                {t("noResults")}
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {results.map((submission, i) => (
                  <SubmissionListRow key={submission.id} submission={submission} rank={i + 1} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
