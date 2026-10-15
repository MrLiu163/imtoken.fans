import "server-only";
import { readFile } from "fs/promises";
import path from "path";
import type { ModerationTargetType } from "@/lib/moderation/settings";

export interface ModerationDecision {
  approved: boolean;
  reason: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 20_000;

const PROMPT_FILES: Record<ModerationTargetType, string> = {
  submission: "submission.md",
  comment: "comment.md",
};

async function loadPrompt(targetType: ModerationTargetType): Promise<string> {
  const filePath = path.join(process.cwd(), "src/lib/moderation/prompts", PROMPT_FILES[targetType]);
  return readFile(filePath, "utf-8");
}

// 没配置 AI_MODERATION_API_KEY 时返回 null；调用失败（超时/网络错误/非 2xx/没拿到结构化结果）
// 也统一返回 null —— 这条内容会留在人工审核队列里，不会卡死也不会被误发布。
export async function runAiModeration(params: {
  targetType: ModerationTargetType;
  content: string;
}): Promise<ModerationDecision | null> {
  const apiKey = process.env.AI_MODERATION_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.AI_MODERATION_API_URL || DEFAULT_API_URL;
  const model = process.env.AI_MODERATION_MODEL || DEFAULT_MODEL;

  try {
    const systemPrompt = await loadPrompt(params.targetType);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: "user", content: params.content }],
          tools: [
            {
              name: "submit_moderation_decision",
              description: "Submit the moderation decision for the reviewed content.",
              input_schema: {
                type: "object",
                properties: {
                  approved: { type: "boolean", description: "true to publish, false to reject" },
                  reason: { type: "string", description: "one short sentence explaining the decision" },
                },
                required: ["approved", "reason"],
              },
            },
          ],
          tool_choice: { type: "tool", name: "submit_moderation_decision" },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) return null;

    const data = await response.json();
    const toolUseBlock = (data.content as Array<Record<string, unknown>> | undefined)?.find(
      (block) => block.type === "tool_use" && block.name === "submit_moderation_decision"
    );
    if (!toolUseBlock) return null;

    const input = toolUseBlock.input as { approved?: unknown; reason?: unknown };
    if (typeof input?.approved !== "boolean") return null;

    return { approved: input.approved, reason: typeof input.reason === "string" ? input.reason : "" };
  } catch {
    return null;
  }
}
