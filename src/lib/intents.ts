// 注册引导里的「你想怎么参与」多选。id 存进 profiles.intents，前台文案走 messages。
export const MAX_INTENTS = 3;

export const INTENT_IDS = ["maker", "tester", "idea"] as const;

export type IntentId = (typeof INTENT_IDS)[number];

const VALID_INTENT_IDS = new Set<string>(INTENT_IDS);

export function normalizeIntents(input: string[]): string[] {
  return [...new Set(input.filter((id) => VALID_INTENT_IDS.has(id)))].slice(0, MAX_INTENTS);
}
