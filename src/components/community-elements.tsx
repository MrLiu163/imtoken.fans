"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { COMMUNITY_SECTIONS, SECTION_CATEGORIES, type CommunitySection } from "@/lib/community-demo";

export function CommunityGlyph({ section }: { section: CommunitySection }) {
  const shapes = {
    safety: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    feedback: <><path d="M4 4h16v12H9l-5 4V4Z" /><path d="M8 8h8M8 12h5" /></>,
    discussion: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 21v-3a6 6 0 0 1 12 0v3M15 15a5 5 0 0 1 7 4v2" /></>,
    activities: <><path d="M4 7h16v14H4zM8 3v7M16 3v7M4 12h16m-11 5 2 2 4-4" /></>,
  };
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{shapes[section]}</svg>;
}

export function ComposeDemoButton({ section = "discussion", compact = false }: { section?: CommunitySection; compact?: boolean }) {
  const t = useTranslations("community");
  const dialogTitle = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [board, setBoard] = useState<CommunitySection>(section);
  const [category, setCategory] = useState(SECTION_CATEGORIES[section].find((value) => value !== "announcements" && value !== "changelog")!);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  function submit(event: FormEvent) { event.preventDefault(); setPreview(true); }
  return <><button ref={trigger} aria-label={t("compose")} className={`community-button ${compact ? "community-compose-compact" : ""}`} type="button" onClick={() => { setPreview(false); dialog.current?.showModal(); }}>{t("compose")}<span aria-hidden>＋</span></button><dialog ref={dialog} aria-labelledby={dialogTitle} className="community-compose-dialog" onClose={() => trigger.current?.focus()} onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}><div className="community-dialog-content"><div className="community-dialog-heading"><h2 id={dialogTitle}>{t("composeTitle")}</h2><button type="button" className="community-icon-button" aria-label={t("close")} onClick={() => dialog.current?.close()}>×</button></div><p className="community-compose-notice">{t("composeNotice")}</p>{preview ? <div className="community-preview-result" role="status"><span className="community-demo-label">{t("previewOnly")}</span><p className="community-preview-category">{t(`sections.${board}.name`)} › {t(`categories.${category}`)}</p><h3>{title}</h3><p className="community-preview-body">{body}</p><button type="button" className="community-button community-button-outline" onClick={() => setPreview(false)}>{t("editPreview")}</button></div> : <form onSubmit={submit}><label>{t("boardField")}<select value={board} onChange={(event) => { const value = event.target.value as CommunitySection; setBoard(value); setCategory(SECTION_CATEGORIES[value].find((item) => item !== "announcements" && item !== "changelog")!); }}>{COMMUNITY_SECTIONS.map((value) => <option key={value} value={value}>{t(`sections.${value}.name`)}</option>)}</select></label><label>{t("contentTypeField")}<select value={category} onChange={(event) => setCategory(event.target.value)}>{SECTION_CATEGORIES[board].filter((value) => value !== "changelog" && value !== "announcements").map((value) => <option key={value} value={value}>{t(`categories.${value}`)}</option>)}</select></label><label>{t("titleField")}<input required maxLength={60} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("titlePlaceholder")} /></label><label>{t("bodyField")}<textarea required maxLength={2000} rows={7} value={body} onChange={(event) => setBody(event.target.value)} placeholder={t("bodyPlaceholder")} /></label><button type="submit" disabled={!title.trim() || !body.trim()} className="community-button">{t("previewCta")}<span aria-hidden>↗</span></button></form>}</div></dialog></>;
}
