// 专长选项：个人资料的「专长」多选字段，以及点子征集队友时匹配"需要什么样的人"共用同一份定义。
// id 是存进 profiles.expertise 的固定值，zh/en 只是展示文案。
export const MAX_EXPERTISE = 5;

export const EXPERTISE_OPTIONS = [
  { id: "growth", zh: "增长", en: "Growth" },
  { id: "engineering", zh: "研发", en: "Engineering" },
  { id: "product", zh: "产品", en: "Product" },
  { id: "design", zh: "设计", en: "Design" },
  { id: "marketing", zh: "市场", en: "Marketing" },
  { id: "operations", zh: "运营", en: "Operations" },
  { id: "sales", zh: "销售", en: "Sales" },
  { id: "content", zh: "内容 / 文案", en: "Content" },
  { id: "bizdev", zh: "商务拓展", en: "Business Development" },
  { id: "kol", zh: "KOL / 内容创作者", en: "KOL / Creator" },
  { id: "investing", zh: "投资", en: "Investing" },
  { id: "data", zh: "数据", en: "Data" },
  { id: "legal", zh: "法务", en: "Legal" },
  { id: "other", zh: "其他", en: "Other" },
] as const;

export type ExpertiseId = (typeof EXPERTISE_OPTIONS)[number]["id"];

const VALID_EXPERTISE_IDS = new Set<string>(EXPERTISE_OPTIONS.map((o) => o.id));

// 只保留合法的专长 id、去重、限量——防止客户端绕过 UI 直接传一堆垃圾字符串进来。
export function normalizeExpertise(input: string[]): string[] {
  return [...new Set(input.filter((id) => VALID_EXPERTISE_IDS.has(id)))].slice(0, MAX_EXPERTISE);
}

export function getExpertiseLabel(id: string, locale: string): string {
  const option = EXPERTISE_OPTIONS.find((o) => o.id === id);
  if (!option) return id;
  return locale === "zh" ? option.zh : option.en;
}
