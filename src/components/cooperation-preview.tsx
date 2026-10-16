"use client";

import { useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { IDEA_MODULES, IDEA_STATES, IDEA_MARKS, VIEWER, initialCooperationDemo, ideaGroup, ideaVoters, setIdeaVote, mergePair, undoMerge, type DemoIdea, type IdeaComment, type IdeaModule, type IdeaState, type IdeaMark } from "@/lib/cooperation-demo";
import styles from "./cooperation-preview.module.css";

function IdeaEditor({ idea, title, description, onSave, onCancel }: { idea: DemoIdea; title: string; description: string; onSave: (change: { title: string; description: string; module: IdeaModule; status: IdeaState; mark: IdeaMark }) => void; onCancel: () => void }) {
  const t = useTranslations("cooperation");
  const [draft, setDraft] = useState({ title, description, module: idea.module, status: idea.status, mark: idea.mark });
  return <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); if (draft.title.trim() && draft.description.trim()) onSave({ ...draft, title: draft.title.trim(), description: draft.description.trim() }); }}>
    <h3>{t("editIdea")}</h3>
    <label>{t("titleLabel")}<input required maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
    <label>{t("descriptionLabel")}<textarea required rows={5} maxLength={5000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
    <div className={styles.fields}><label>{t("moduleLabel")}<select value={draft.module} onChange={(e) => setDraft({ ...draft, module: e.target.value as IdeaModule })}>{IDEA_MODULES.map((item) => <option key={item} value={item}>{t(`modules.${item}`)}</option>)}</select></label>
    <label>{t("statusLabel")}<select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as IdeaState })}>{IDEA_STATES.map((item) => <option key={item} value={item}>{t(`states.${item}`)}</option>)}</select></label>
    <label>{t("markLabel")}<select value={draft.mark} onChange={(e) => setDraft({ ...draft, mark: e.target.value as IdeaMark })}>{IDEA_MARKS.map((item) => <option key={item} value={item}>{t(`marks.${item}`)}</option>)}</select></label></div>
    <div className={styles.actions}><button className={styles.primary} type="submit" disabled={!draft.title.trim() || !draft.description.trim()}>{t("save")}</button><button type="button" onClick={onCancel}>{t("cancel")}</button></div>
  </form>;
}

export function CooperationPreview({ embedded = false }: { embedded?: boolean }) {
  const Container = embedded ? "section" : "main";
  const t = useTranslations("cooperation");
  const format = useFormatter();
  const [data, setData] = useState(initialCooperationDemo);
  const [selected, setSelected] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [view, setView] = useState<"list" | "progress">("list");
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("popular");
  const [draft, setDraft] = useState({ title: "", description: "", module: "wallet" as IdeaModule });
  const [editing, setEditing] = useState(false);
  const [mergeId, setMergeId] = useState("");
  const [mergePreview, setMergePreview] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [commentEdit, setCommentEdit] = useState<{ id: string; body: string; mark: IdeaMark } | null>(null);
  const [notice, setNotice] = useState("");
  const sequence = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const commentInput = useRef<HTMLTextAreaElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const title = (idea: DemoIdea) => idea.title ?? t(`seeds.${idea.seed}.title`);
  const description = (idea: DemoIdea) => idea.description ?? t(`seeds.${idea.seed}.description`);
  const body = (comment: IdeaComment) => comment.body ?? t(`comments.${comment.seed}`);
  const rootIds = data.ideas.filter((idea) => !data.merges.some((merge) => merge.source === idea.id));
  const active = data.ideas.find((idea) => idea.id === selected);
  const group = active ? ideaGroup(data, active.id) : [];
  const comments = data.comments.filter((comment) => group.includes(comment.ideaId));
  const currentMerge = data.merges.find((merge) => merge.target === active?.id);
  const mergeChoices = active && !data.merges.some((merge) => [merge.source, merge.target].includes(active.id)) ? rootIds.filter((idea) => idea.id !== active.id && !data.merges.some((merge) => [merge.source, merge.target].includes(idea.id))) : [];
  const mergeCandidate = mergeChoices.find((idea) => idea.id === mergeId);
  const mergeTarget = active && mergeCandidate ? [active, mergeCandidate].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0] : null;
  const visible = rootIds.filter((idea) => (module === "all" || idea.module === module) && (status === "all" || idea.status === status) && `${title(idea)} ${description(idea)}`.toLowerCase().includes(query.toLowerCase().trim())).sort((a, b) => sort === "popular" ? ideaVoters(data, b.id).length - ideaVoters(data, a.id).length || a.createdAt.localeCompare(b.createdAt) : sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const terms = draft.title.toLowerCase().match(/[a-z0-9]{3,}|[\u4e00-\u9fff]{2,}/g)?.flatMap((term) => /[\u4e00-\u9fff]/.test(term) ? Array.from({ length: term.length - 1 }, (_, index) => term.slice(index, index + 2)) : [term]) ?? [];
  const similar = terms.length ? rootIds.filter((idea) => terms.some((term) => `${title(idea)} ${description(idea)}`.toLowerCase().includes(term))).slice(0, 3) : [];
  function openIdea(id: string) {
    setSelected(ideaGroup(data, id)[0]); setEditing(false); setMergeId(""); setMergePreview(false); setReplyTo(null); setCommentBody(""); setCommentEdit(null);
    requestAnimationFrame(() => detailHeading.current?.focus());
  }
  function vote(idea: DemoIdea) { setData((current) => setIdeaVote(current, idea.id, !ideaVoters(current, idea.id).includes(VIEWER))); }
  function submitIdea(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.description.trim()) return;
    const id = `local-${++sequence.current}`;
    setData((current) => ({ ...current, ideas: [...current.ideas, { id, title: draft.title.trim(), description: draft.description.trim(), author: VIEWER, createdAt: new Date().toISOString(), module: draft.module, status: "inbox", mark: "none", voters: [], revisions: [] }] }));
    setDraft({ title: "", description: "", module: "wallet" }); setSelected(id); setEditing(false); setMergeId(""); setMergePreview(false); setReplyTo(null); setCommentBody(""); setCommentEdit(null); setNotice(t("created"));
    requestAnimationFrame(() => detailHeading.current?.focus());
  }
  function submitComment(event: FormEvent) {
    event.preventDefault(); if (!active || !commentBody.trim()) return;
    const parent = data.comments.find((comment) => comment.id === replyTo && group.includes(comment.ideaId));
    if (replyTo && !parent) { setReplyTo(null); setNotice(t("replyExpired")); return; }
    const comment: IdeaComment = { id: `comment-${++sequence.current}`, ideaId: parent?.ideaId ?? active.id, parent: parent?.id, body: commentBody.trim(), author: VIEWER, voters: [], mark: "none", revisions: [] };
    setData((current) => ({ ...current, comments: [...current.comments, comment] })); setCommentBody(""); setReplyTo(null); setNotice(t("commentAdded"));
  }
  function renderComment(comment: IdeaComment, depth = 0) {
    const origin = data.ideas.find((idea) => idea.id === comment.ideaId)!;
    return <li key={comment.id} className={styles.comment}>
      <div className={styles.meta}><strong>{t(`authors.${comment.author}`)}</strong><span>{t("exampleUser")}</span>{comment.mark !== "none" && <span className={styles.tag}>{t(`marks.${comment.mark}`)}</span>}{comment.revisions.length > 0 && <span>{t("edited", { count: comment.revisions.length })}</span>}</div>
      {group.length > 1 && <p className={styles.origin}>{t("origin", { title: title(origin) })}</p>}
      <p className={styles.body}>{body(comment)}</p>
      <div className={styles.actions}><button type="button" aria-pressed={comment.voters.includes(VIEWER)} aria-label={t("commentVote", { count: comment.voters.length })} onClick={() => setData((current) => ({ ...current, comments: current.comments.map((item) => item.id !== comment.id ? item : { ...item, voters: item.voters.includes(VIEWER) ? item.voters.filter((voter) => voter !== VIEWER) : [...item.voters, VIEWER] }) }))}>△ {format.number(comment.voters.length)}</button><button type="button" onClick={() => { setReplyTo(comment.id); commentInput.current?.focus(); }}>{t("reply")}</button>{admin && <button type="button" onClick={() => setCommentEdit({ id: comment.id, body: body(comment), mark: comment.mark })}>{t("editComment")}</button>}</div>
      {admin && commentEdit?.id === comment.id && <form className={styles.editor} onSubmit={(event) => { event.preventDefault(); if (!commentEdit.body.trim()) return; setData((current) => ({ ...current, comments: current.comments.map((item) => item.id === comment.id ? { ...item, body: commentEdit.body.trim(), mark: commentEdit.mark, revisions: [...item.revisions, { body: body(item), mark: item.mark }] } : item) })); setCommentEdit(null); setNotice(t("saved")); }}>
        <label>{t("commentLabel")}<textarea required maxLength={2000} value={commentEdit.body} onChange={(event) => setCommentEdit({ ...commentEdit, body: event.target.value })} /></label>
        <label>{t("markLabel")}<select value={commentEdit.mark} onChange={(event) => setCommentEdit({ ...commentEdit, mark: event.target.value as IdeaMark })}>{IDEA_MARKS.map((mark) => <option key={mark} value={mark}>{t(`marks.${mark}`)}</option>)}</select></label>
        <div className={styles.actions}><button className={styles.primary} disabled={!commentEdit.body.trim()}>{t("save")}</button><button type="button" onClick={() => setCommentEdit(null)}>{t("cancel")}</button></div>
      </form>}
      {comment.revisions.length > 0 && <details className={styles.history}><summary>{t("history")}</summary>{comment.revisions.map((previous, index) => <p className={styles.body} key={index}>{t("revision", { index: index + 1 })} · {t(`marks.${previous.mark}`)}{String.fromCharCode(10)}{previous.body}</p>)}</details>}
      {data.comments.some((item) => item.parent === comment.id) && <ul className={depth < 2 ? styles.replies : styles.flatReplies}>{data.comments.filter((item) => item.parent === comment.id).map((item) => renderComment(item, depth + 1))}</ul>}
    </li>;
  }
  function renderRow(idea: DemoIdea) {
    const voters = ideaVoters(data, idea.id);
    const count = data.comments.filter((comment) => ideaGroup(data, idea.id).includes(comment.ideaId)).length;
    return <article key={idea.id} className={styles.row}>
      <button type="button" className={styles.vote} aria-pressed={voters.includes(VIEWER)} aria-label={t("ideaVote", { title: title(idea), count: voters.length })} onClick={() => vote(idea)}><span aria-hidden>△</span><strong>{format.number(voters.length)}</strong></button>
      <div className={styles.rowMain}><div className={styles.tags}><span className={styles.status}>{t(`states.${idea.status}`)}</span><span>{t(`modules.${idea.module}`)}</span>{idea.mark !== "none" && <span className={styles.tag}>{t(`marks.${idea.mark}`)}</span>}</div><button className={styles.ideaTitle} type="button" onClick={() => openIdea(idea.id)}>{title(idea)}</button><p className={styles.excerpt}>{description(idea)}</p><div className={styles.meta}><span>{t(`authors.${idea.author}`)}</span><time dateTime={idea.createdAt}>{format.dateTime(new Date(idea.createdAt), { month: "short", day: "numeric", timeZone: "Asia/Shanghai" })}</time><span>{t("commentCount", { count })}</span>{ideaGroup(data, idea.id).length > 1 && <span>{t("mergedBadge")}</span>}</div></div>
    </article>;
  }
  return <Container className={`${styles.page} ${embedded ? styles.embedded : "community-page"}`} id={embedded ? undefined : "main-content"} tabIndex={-1} aria-label={embedded ? t("embeddedHeading") : undefined}>
    <div className={styles.notice}>{t(embedded ? "embeddedDemoNotice" : "demoNotice")}</div>
    <div className={embedded ? styles.embeddedShell : `community-shell ${styles.shell}`}>
      {!embedded && <nav className="community-breadcrumb" aria-label={t("breadcrumb")}><Link href="/">{t("home")}</Link><span aria-hidden>/</span><span>{t("heading")}</span></nav>}
      <header className={styles.heading}><div>{embedded ? <h2>{t("embeddedHeading")}</h2> : <><p className={styles.eyebrow}>{t("eyebrow")}</p><h1>{t("heading")}</h1></>}<p>{t("subtitle")}</p></div><label className={styles.adminToggle}><input type="checkbox" checked={admin} onChange={(event) => { setAdmin(event.target.checked); setEditing(false); setCommentEdit(null); setMergePreview(false); }} />{t("adminMode")}</label></header>
      {!embedded && <nav className={styles.subnav} aria-label={t("sectionsLabel")}><span aria-current="page">{t("feedback")}</span><Link href="/community/feedback/ai-explainer">{t("builds")}</Link><Link href="/community/feedback/reading-release-notes">{t("changelog")}</Link></nav>}
      {admin && <p className={styles.adminNotice}>{t("adminNotice")}</p>}
      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <section className={styles.panel}><h2>{t("createHeading")}</h2><p className={styles.muted}>{t("createIntro")}</p><form className={styles.form} onSubmit={submitIdea}>
            <label>{t("moduleLabel")}<select value={draft.module} onChange={(event) => setDraft({ ...draft, module: event.target.value as IdeaModule })}>{IDEA_MODULES.map((item) => <option key={item} value={item}>{t(`modules.${item}`)}</option>)}</select></label>
            <label>{t("titleLabel")}<input ref={titleInput} required maxLength={120} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder={t("titlePlaceholder")} /></label>
            {draft.title.trim() && <section className={styles.similar} aria-label={t("similarHeading")}><h3>{t("similarHeading")}</h3><p>{t("keywordOnly")}</p>{similar.length ? similar.map((idea) => <button type="button" key={idea.id} onClick={() => openIdea(idea.id)}>{title(idea)} <span aria-hidden>↗</span></button>) : <p>{t("noSimilar")}</p>}</section>}
            <label>{t("descriptionLabel")}<textarea required rows={5} maxLength={5000} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder={t("descriptionPlaceholder")} /></label>
            <p className={styles.muted}>{t("safety")}</p><button type="submit" className={styles.primary} disabled={!draft.title.trim() || !draft.description.trim()}>{t("submit")}</button>
          </form></section>
          <section className={`${styles.panel} ${styles.context}`}><h2>{t("howTitle")}</h2><p>{t("howBody")}</p><p>{t("prototypeLimit")}</p><a href="https://www.youtube.com/watch?v=3pSd2A9Cg5k" target="_blank" rel="noreferrer">{t("reference")} ↗</a></section>
        </aside>
        <section className={styles.main} aria-label={t("feedback")}>
          <div className={styles.toolbar}><div className={styles.actions}><button type="button" aria-pressed={!active && view === "list"} onClick={() => { setSelected(null); setView("list"); }}>{t("listView")}</button><button type="button" aria-pressed={!active && view === "progress"} onClick={() => { setSelected(null); setView("progress"); }}>{t("progressView")}</button></div><button type="button" onClick={() => { titleInput.current?.focus(); titleInput.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }}>{t("submit")}</button></div>
          {active ? <article className={styles.panel}>
            <button type="button" className={styles.back} onClick={() => { setSelected(null); setEditing(false); }}>{t("back")}</button>
            <div className={styles.tags}><span className={styles.status}>{t(`states.${active.status}`)}</span><span>{t(`modules.${active.module}`)}</span>{active.mark !== "none" && <span className={styles.tag}>{t(`marks.${active.mark}`)}</span>}</div>
            <h2 ref={detailHeading} tabIndex={-1} className={styles.detailTitle}>{title(active)}</h2><div className={styles.meta}><span>{t(`authors.${active.author}`)}</span><span>{t("exampleUser")}</span><time dateTime={active.createdAt}>{format.dateTime(new Date(active.createdAt), { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" })}</time></div>
            <p className={styles.description}>{description(active)}</p>
            <div className={styles.actions}><button type="button" className={styles.support} aria-pressed={ideaVoters(data, active.id).includes(VIEWER)} onClick={() => vote(active)}>△ {t(ideaVoters(data, active.id).includes(VIEWER) ? "supported" : "support")} · {format.number(ideaVoters(data, active.id).length)}</button>{admin && <button type="button" onClick={() => setEditing((value) => !value)}>{t("editIdea")}</button>}</div>
            {admin && editing && <IdeaEditor key={active.id} idea={active} title={title(active)} description={description(active)} onCancel={() => setEditing(false)} onSave={(change) => { setData((current) => ({ ...current, ideas: current.ideas.map((idea) => idea.id === active.id ? { ...idea, ...change, revisions: [...idea.revisions, { title: title(idea), description: description(idea), module: idea.module, status: idea.status, mark: idea.mark }] } : idea) })); setEditing(false); setNotice(t("saved")); }} />}
            {active.revisions.length > 0 && <details className={styles.history}><summary>{t("edited", { count: active.revisions.length })} · {t("history")}</summary>{active.revisions.map((previous, index) => <div key={index}><strong>{t("revision", { index: index + 1 })} · {previous.title}</strong><p className={styles.body}>{previous.description}</p><p>{t(`modules.${previous.module}`)} · {t(`states.${previous.status}`)} · {t(`marks.${previous.mark}`)}</p></div>)}</details>}
            {currentMerge && <section className={styles.mergeBox}><h3>{t("mergeSources")}</h3><p>{t("mergedExplanation")}</p>{data.ideas.filter((idea) => idea.id === currentMerge.source).map((idea) => <details key={idea.id}><summary>{title(idea)}</summary><p className={styles.meta}>{t(`authors.${idea.author}`)} · {format.dateTime(new Date(idea.createdAt), { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Shanghai" })}</p><p className={styles.body}>{description(idea)}</p></details>)}{admin && <button type="button" onClick={() => { setData((current) => undoMerge(current, active.id)); setReplyTo(null); setCommentBody(""); setCommentEdit(null); setEditing(false); setNotice(t("unmerged")); }}>{t("undoMerge")}</button>}</section>}
            {admin && !currentMerge && <section className={styles.mergeBox}><h3>{t("mergeHeading")}</h3><p>{t("mergeLimit")}</p><label>{t("mergeSelect")}<select value={mergeCandidate ? mergeId : ""} onChange={(event) => { setMergeId(event.target.value); setMergePreview(false); }}><option value="">{t("chooseIdea")}</option>{mergeChoices.map((idea) => <option key={idea.id} value={idea.id}>{title(idea)}</option>)}</select></label><button type="button" disabled={!mergeCandidate} onClick={() => setMergePreview(true)}>{t("previewMerge")}</button>
              {mergePreview && mergeCandidate && mergeTarget && <div className={styles.mergePreview}><h4>{t("mergePreviewTitle")}</h4><p>{t("mergeTarget", { title: title(mergeTarget) })}</p><p>{t("mergeCounts", { before: ideaVoters(data, active.id).length + ideaVoters(data, mergeCandidate.id).length, after: new Set([...ideaVoters(data, active.id), ...ideaVoters(data, mergeCandidate.id)]).size })}</p><p>{t("mergeUndoNote")}</p><div className={styles.actions}><button className={styles.primary} type="button" onClick={() => { setData((current) => mergePair(current, active.id, mergeCandidate.id)); setSelected(mergeTarget.id); setMergeId(""); setMergePreview(false); setReplyTo(null); setCommentBody(""); setCommentEdit(null); setEditing(false); setNotice(t("merged")); }}>{t("confirmMerge")}</button><button type="button" onClick={() => setMergePreview(false)}>{t("cancel")}</button></div></div>}
            </section>}
            <section className={styles.discussion}><h3>{t("discussion", { count: comments.length })}</h3><form className={styles.form} onSubmit={submitComment}>{replyTo && <div className={styles.replyTarget}><p>{t("replyingTo", { name: t(`authors.${data.comments.find((comment) => comment.id === replyTo)?.author ?? VIEWER}`) })}</p><button type="button" onClick={() => setReplyTo(null)}>{t("cancelReply")}</button></div>}<label>{t("commentLabel")}<textarea ref={commentInput} required maxLength={2000} rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder={t("commentPlaceholder")} /></label><button type="submit" className={styles.primary} disabled={!commentBody.trim()}>{t(replyTo ? "sendReply" : "sendComment")}</button></form><ul className={styles.comments}>{comments.filter((comment) => !comment.parent).map((comment) => renderComment(comment))}</ul>{!comments.length && <p className={styles.muted}>{t("noComments")}</p>}</section>
          </article> : <>
            <div className={styles.filters}><label className={styles.search}>{t("search")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} /></label><label>{t("moduleLabel")}<select value={module} onChange={(event) => setModule(event.target.value)}><option value="all">{t("allModules")}</option>{IDEA_MODULES.map((item) => <option key={item} value={item}>{t(`modules.${item}`)}</option>)}</select></label><label>{t("statusLabel")}<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">{t("allStates")}</option>{IDEA_STATES.map((item) => <option key={item} value={item}>{t(`states.${item}`)}</option>)}</select></label><label>{t("sortLabel")}<select value={sort} onChange={(event) => setSort(event.target.value)}>{["popular", "latest", "oldest"].map((item) => <option key={item} value={item}>{t(`sorts.${item}`)}</option>)}</select></label></div>
            <p className={styles.resultCount} role="status">{t("resultCount", { count: visible.length })}</p>
            {!visible.length && <section className={styles.panel}><h2>{t("empty")}</h2><p>{t("emptyHint")}</p><button type="button" onClick={() => { setQuery(""); setModule("all"); setStatus("all"); }}>{t("clearFilters")}</button></section>}
            {view === "list" ? <div className={styles.list}>{visible.map(renderRow)}</div> : <><p className={styles.muted}>{t("progressNotice")}</p><div className={styles.board}>{IDEA_STATES.filter((state) => status === "all" || status === state).map((state) => <section key={state} className={styles.column}><h2>{t(`states.${state}`)} <span>{visible.filter((idea) => idea.status === state).length}</span></h2>{visible.filter((idea) => idea.status === state).map(renderRow)}{!visible.some((idea) => idea.status === state) && <p className={styles.muted}>{t("emptyColumn")}</p>}</section>)}</div></>}
          </>}
        </section>
      </div><p className={styles.live} role="status" aria-live="polite">{notice}</p>
    </div>
  </Container>;
}
