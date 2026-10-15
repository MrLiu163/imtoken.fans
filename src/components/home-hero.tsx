import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function HomeHero() {
  const t = useTranslations("fansHome");
  const sections = ["safety", "feedback", "discussion", "activities"] as const;
  return (
    <section className="fans-hero fans-container" aria-labelledby="home-title">
      <div className="fans-hero-copy">
        <p className="fans-eyebrow"><span aria-hidden />{t("eyebrow")}</p>
        <h1 id="home-title">{t("titleLine1")}<br /><span>{t("titleLine2")}</span></h1>
        <p className="fans-hero-description">{t("description")}</p>
        <div className="fans-actions">
          <a href="#sections" className="fans-button">{t("browse")}<span aria-hidden>↗</span></a>
          <Link href="/ideas" className="fans-text-link">{t("joinAI")}<span aria-hidden>→</span></Link>
        </div>
        <p className="fans-community-note">{t("communityNote")}</p>
      </div>
      <nav className="fans-guide" aria-label={t("guideLabel")}>
        <div className="fans-guide-heading"><span>{t("guideTitle")}</span><span aria-hidden>↘</span></div>
        {sections.map((section, index) => (
          <a href={`#${section}`} key={section} className="fans-guide-item">
            <span className="fans-guide-number" aria-hidden>{`0${index + 1}`}</span>
            <span><strong>{t(`${section}.name`)}</strong><small>{t(`${section}.short`)}</small></span>
            <span className="fans-guide-arrow" aria-hidden>↗</span>
          </a>
        ))}
      </nav>
    </section>
  );
}
