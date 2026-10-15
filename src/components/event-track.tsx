"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { DragTrack, TiltCard } from "@/components/drag-track";
import { EventArt } from "@/components/event-art";

function skipIfDragging(event: { currentTarget: EventTarget & HTMLElement; preventDefault: () => void }) {
  if ((event.currentTarget.closest(".drag-track") as HTMLElement | null)?.dataset.dragging) {
    event.preventDefault();
  }
}

export function EventTrack() {
  const t = useTranslations("events");
  const th = useTranslations("home");
  const cards = [
    { slug: "spark-camp", tone: "ember" as const, kind: t("spark.kind"), name: t("spark.name"), hook: t("spark.hook") },
    { slug: "night-studio", tone: "indigo" as const, kind: t("studio.kind"), name: t("studio.name"), hook: t("studio.hook") },
    { slug: "field-notes", tone: "paper" as const, kind: t("notes.kind"), name: t("notes.name"), hook: t("notes.hook") },
    { slug: "hearth", tone: "rose" as const, kind: t("hearth.kind"), name: t("hearth.name"), hook: t("hearth.hook") },
  ];

  return (
    <section className="py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{th("nowTitle")}</h2>
      </div>
      <DragTrack ariaLabel={th("nowTitle")} className="mt-8">
        {cards.map((event) => (
          <div key={event.slug} className="event-slide">
            <TiltCard>
              <Link href={`/events/${event.slug}`} className={`event-card event-card-${event.tone}`} onClick={skipIfDragging}>
                <EventArt tone={event.tone} />
                <p className="event-kind">{event.kind}</p>
                <h3 className="event-name font-display">{event.name}</h3>
                <p className="event-hook">{event.hook}</p>
                <span className="event-cta">{th("viewDetails")}</span>
              </Link>
            </TiltCard>
          </div>
        ))}
      </DragTrack>
    </section>
  );
}
