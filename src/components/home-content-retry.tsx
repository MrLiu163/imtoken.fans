"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function HomeContentRetry() {
  const router = useRouter();
  const t = useTranslations("fansHome");
  return <button className="fans-text-link" type="button" onClick={() => router.refresh()}>{t("retry")}<span aria-hidden>↻</span></button>;
}
