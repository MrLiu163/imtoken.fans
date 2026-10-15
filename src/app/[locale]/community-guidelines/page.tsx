import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell, EditorialSection } from "@/components/editorial-page";

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations("meta");
  return { title: tMeta("guidelinesTitle"), description: tMeta("guidelinesDescription") };
}

export default async function GuidelinesPage() {
  const t = await getTranslations("guidelines");
  return (
    <DocsShell eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <EditorialSection title={t("principlesTitle")}>
        <Rules items={[t("principle1"), t("principle2"), t("principle3"), t("principle4")]} />
      </EditorialSection>
      <EditorialSection title={t("makerTitle")}>
        <Rules items={[t("maker1"), t("maker2"), t("maker3"), t("maker4")]} />
      </EditorialSection>
      <EditorialSection title={t("feedbackTitle")}>
        <Rules items={[t("feedback1"), t("feedback2"), t("feedback3"), t("feedback4")]} />
      </EditorialSection>
      <EditorialSection title={t("notAllowedTitle")}>
        <Rules items={[t("notAllowed1"), t("notAllowed2"), t("notAllowed3"), t("notAllowed4"), t("notAllowed5")]} />
      </EditorialSection>
      <EditorialSection title={t("moderationTitle")}>
        <p>{t("moderationBody1")}</p>
        <p>{t("moderationBody2")}</p>
      </EditorialSection>
      <EditorialSection title={t("disclaimerTitle")}>
        <p>{t("disclaimerBody")}</p>
      </EditorialSection>
    </DocsShell>
  );
}

function Rules({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
