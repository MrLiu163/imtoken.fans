"use client";
import { useTranslations } from "next-intl";
export default function CommunityError({ reset }: { reset: () => void }) {
  const t = useTranslations("community");
  return <section className="community-shell community-missing"><h1>{t("failed")}</h1><button type="button" className="community-button" onClick={reset}>{t("retry")}</button></section>;
}
