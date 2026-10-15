import { useTranslations } from "next-intl";

const PARTNERS = [
  { name: "imToken", src: "/partners/imtoken.svg", href: "https://token.im", kind: "wide" },
  { name: "imKey", src: "/partners/imkey.svg", href: "https://imkey.im", kind: "device" },
  { name: "Tokenlon", src: "/partners/tokenlon.svg", href: "https://tokenlon.im", kind: "wide" },
  { name: "TokensAPI", src: "/partners/tokensapi.png", href: "https://tokensapi.ai", kind: "mark" },
  { name: "imTokenFans", src: "/partners/imtokenfans.svg", href: "https://imtoken.fans", kind: "mark" },
] as const;

export function PartnerMarquee() {
  const t = useTranslations("home");
  const sequence = [...PARTNERS, ...PARTNERS, ...PARTNERS];

  return (
    <section className="partner-marquee" aria-label={t("partnersLabel")}>
      <div className="partner-marquee-track">
        {sequence.map((partner, index) => (
          <a
            key={`${partner.name}-${index}`}
            href={partner.href}
            target="_blank"
            rel="noreferrer"
            className="partner-chip"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={partner.src} alt="" className={`partner-logo partner-logo-${partner.kind}`} />
            {partner.kind !== "wide" && <span>{partner.name}</span>}
            <span className="sr-only">{partner.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
