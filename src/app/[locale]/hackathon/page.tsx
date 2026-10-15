import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DocsShell, EditorialSection } from "@/components/editorial-page";

export async function generateMetadata(): Promise<Metadata> {
  const tMeta = await getTranslations("meta");
  return { title: tMeta("hackathonTitle"), description: tMeta("hackathonDescription") };
}

export default async function HackathonPage() {
  const t = await getTranslations("hackathon");
  return (
    <DocsShell eyebrow={t("eyebrow")} title={t("title")} intro={t("intro")}>
      <EditorialSection title={t("boundaryTitle")}>
        <p>{t("boundaryBody1")}</p>
        <div className="rounded-2xl border border-brand/20 bg-brand-soft p-5 text-brand-ink">{t("boundaryNote")}</div>
      </EditorialSection>
      <EditorialSection title={t("publicTitle")}>
        <p>{t("publicBody")}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>{t("public1")}</li>
          <li>{t("public2")}</li>
          <li>{t("public3")}</li>
        </ul>
      </EditorialSection>
      <EditorialSection title={t("timelineTitle")}>
        <p>{t("timelineBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("resultTitle")}>
        <p>{t("resultBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("supportTitle")}>
        <p>{t("supportBody")}</p>
      </EditorialSection>
      <EditorialSection title={t("ipTitle")}>
        <p>{t("ipBody")}</p>
      </EditorialSection>
    </DocsShell>
  );
}
