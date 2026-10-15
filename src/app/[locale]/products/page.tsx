import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getPublishedSubmissionCards } from "@/lib/submissions";
import { SubmissionListRow } from "@/components/submission-list-row";

export default async function ProductsPage() {
  const t = await getTranslations("products");
  const products = (await getPublishedSubmissionCards("product")).sort(
    (a, b) => b.votes_paid + b.votes_creative - (a.votes_paid + a.votes_creative)
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
      <div className="max-w-3xl">
        <h1 className="mb-5 text-2xl font-extrabold text-ink">{t("title")}</h1>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface-2 p-8 text-center text-sm text-muted">
            {t.rich("empty", {
              submitLink: (chunks) => (
                <Link href="/submit" className="font-medium text-brand-ink hover:underline">
                  {chunks}
                </Link>
              ),
            })}
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-line">
            {products.map((submission, i) => (
              <SubmissionListRow key={submission.id} submission={submission} rank={i + 1} showTypeBadge={false} />
            ))}
          </div>
        )}

        <section className="mt-16 rounded-2xl border border-dashed border-line bg-surface-2 p-6 text-center">
          <p className="font-semibold text-ink">{t("ctaTitle")}</p>
          <p className="mt-1 text-sm text-muted">{t("ctaSubtitle")}</p>
          <Link
            href="/submit"
            className="mt-4 inline-block rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-ink"
          >
            {t("ctaButton")}
          </Link>
        </section>
      </div>
    </div>
  );
}
