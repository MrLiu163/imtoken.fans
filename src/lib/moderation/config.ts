export function isAiModerationConfigured(): boolean {
  return Boolean(process.env.AI_MODERATION_API_KEY);
}
