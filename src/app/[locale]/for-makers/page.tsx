import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell, EditorialSection } from "@/components/editorial-page";

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations("meta");
  return { title: tMeta("makersTitle"), description: tMeta("makersDescription") };
}

export default async function ForMakersPage() {
  const t = await getTranslations("forMakers");
  return (
    <DocsShell eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <EditorialSection title={t("fitTitle")}>
        <p>{t("fitBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("fit1")}</li>
          <li>{t("fit2")}</li>
          <li>{t("fit3")}</li>
        </ul>
      </EditorialSection>
      <EditorialSection title={t("pageTitle")}>
        <p>{t("pageBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("page1")}</li>
          <li>{t("page2")}</li>
          <li>{t("page3")}</li>
          <li>{t("page4")}</li>
        </ul>
      </EditorialSection>
      <EditorialSection title={t("questionTitle")}>
        <p>{t("questionBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("updateTitle")}>
        <p>{t("updateBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("responseTitle")}>
        <p>{t("responseBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("statusTitle")}>
        <p>{t("statusBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("notTitle")}>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("not1")}</li>
          <li>{t("not2")}</li>
          <li>{t("not3")}</li>
        </ul>
      </EditorialSection>
    </DocsShell>
  );
}
