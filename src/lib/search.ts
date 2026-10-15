import type { SubmissionCard } from "@/lib/types";

export interface ParsedSearchQuery {
  username: string | null;
  keywords: string | null;
}

// "user:名字" 搜索某个用户发布的内容，否则按关键词匹配标题/简介/描述/标签。
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const trimmed = query.trim();
  const userMatch = trimmed.match(/^user:(.+)$/i);
  if (userMatch) {
    return { username: userMatch[1].trim(), keywords: null };
  }
  return { username: null, keywords: trimmed || null };
}

export function searchSubmissions(submissions: SubmissionCard[], query: string): SubmissionCard[] {
  const parsed = parseSearchQuery(query);

  if (parsed.username) {
    const needle = parsed.username.toLowerCase();
    if (!needle) return [];
    return submissions.filter((s) => (s.submitted_by_username ?? "").toLowerCase().includes(needle));
  }

  if (!parsed.keywords) return [];
  const needle = parsed.keywords.toLowerCase();
  return submissions.filter(
    (s) =>
      s.title.toLowerCase().includes(needle) ||
      s.tagline.toLowerCase().includes(needle) ||
      s.description.toLowerCase().includes(needle) ||
      s.tags.some((t) => t.toLowerCase().includes(needle))
  );
}
