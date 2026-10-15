import { useTranslations } from "next-intl";

export function BrandLogo({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/imtoken-fans.png"
      alt={t("brandName")}
      width={238}
      height={56}
      className={className}
      decoding="async"
    />
  );
}
