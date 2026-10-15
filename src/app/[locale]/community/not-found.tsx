import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
export default async function CommunityNotFound() {
  const t = await getTranslations("community");
  return <section className="community-shell community-missing" id="main-content" tabIndex={-1}><h1>{t("notFoundTitle")}</h1><p>{t("notFoundBody")}</p><Link href="/" className="community-button">{t("backHome")}</Link></section>;
}
