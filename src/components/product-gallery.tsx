"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DragTrack, TiltCard } from "@/components/drag-track";
import { getSubmissionMediaUrl } from "@/lib/media";
import type { SubmissionCard } from "@/lib/types";

function skipIfDragging(event: { currentTarget: EventTarget & HTMLElement; preventDefault: () => void }) {
  if ((event.currentTarget.closest(".drag-track") as HTMLElement | null)?.dataset.dragging) {
    event.preventDefault();
  }
}

export function ProductGallery({
  items,
  kind,
}: {
  items: SubmissionCard[];
  kind: "product" | "idea";
}) {
  const t = useTranslations("home");
  const title = kind === "product" ? t("watchTitle") : t("ideasTitle");
  const href = kind === "product" ? "/products" : "/ideas";
  const live = items.slice(0, 8).map((item) => ({
    id: item.id,
    title: item.title,
    tagline: item.tagline,
    logo: item.logo_path ? getSubmissionMediaUrl(item.logo_path) : null,
    href: `/${kind === "product" ? "products" : "ideas"}/${item.id}`,
  }));
  const mocks =
    kind === "product"
      ? [
          { id: "mock-p1", title: t("mockP1Title"), tagline: t("mockP1Tagline"), logo: null, href },
          { id: "mock-p2", title: t("mockP2Title"), tagline: t("mockP2Tagline"), logo: null, href },
          { id: "mock-p3", title: t("mockP3Title"), tagline: t("mockP3Tagline"), logo: null, href },
          { id: "mock-p4", title: t("mockP4Title"), tagline: t("mockP4Tagline"), logo: null, href },
        ]
      : [
          { id: "mock-i1", title: t("mockI1Title"), tagline: t("mockI1Tagline"), logo: null, href },
          { id: "mock-i2", title: t("mockI2Title"), tagline: t("mockI2Tagline"), logo: null, href },
          { id: "mock-i3", title: t("mockI3Title"), tagline: t("mockI3Tagline"), logo: null, href },
          { id: "mock-i4", title: t("mockI4Title"), tagline: t("mockI4Tagline"), logo: null, href },
        ];
  const cards = live.length > 0 ? live : mocks;

  return (
    <section className="py-10">
      <div className="mx-auto flex max-w-6xl items-end justify-between px-4 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{title}</h2>
        <Link href={href} className="text-xs font-bold text-brand-ink hover:underline">
          {t("viewAll")}
        </Link>
      </div>
      <DragTrack ariaLabel={title} className="mt-8">
        {cards.map((item, index) => (
          <div key={item.id} className="gallery-slide">
            <TiltCard>
              <Link
                href={item.href}
                className={`gallery-card gallery-card-${kind} gallery-tint-${(index % 4) + 1}`}
                onClick={skipIfDragging}
              >
                <span className="gallery-orbit" aria-hidden />
                {item.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.logo} alt="" className="gallery-logo" />
                ) : (
                  <span className="gallery-fallback">{item.title.slice(0, 1)}</span>
                )}
                <div className="mt-auto">
                  <h3 className="font-display text-2xl font-extrabold tracking-tight text-white">{item.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/80">{item.tagline}</p>
                </div>
              </Link>
            </TiltCard>
          </div>
        ))}
      </DragTrack>
    </section>
  );
}
