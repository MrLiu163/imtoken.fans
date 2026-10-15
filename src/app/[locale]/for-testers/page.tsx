import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell, EditorialSection } from "@/components/editorial-page";

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations("meta");
  return { title: tMeta("testersTitle"), description: tMeta("testersDescription") };
}

export default async function ForTestersPage() {
  const t = await getTranslations("forTesters");
  return (
    <DocsShell eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <EditorialSection title={t("chooseTitle")}>
        <p>{t("chooseBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("feedbackTitle")}>
        <p>{t("feedbackBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("feedback1")}</li>
          <li>{t("feedback2")}</li>
          <li>{t("feedback3")}</li>
          <li>{t("feedback4")}</li>
        </ul>
      </EditorialSection>
      <EditorialSection title={t("discloseTitle")}>
        <p>{t("discloseBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("safetyTitle")}>
        <p>{t("safetyBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("reputationTitle")}>
        <p>{t("reputationBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("rewardTitle")}>
        <p>{t("rewardBody")}</p>
      </EditorialSection>
    </DocsShell>
  );
}
