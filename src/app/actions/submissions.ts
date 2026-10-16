"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";
import { hasPermission } from "@/lib/admin-guard";
import { isBlacklisted } from "@/lib/user-tags";
import { normalizeTags } from "@/lib/tag-taxonomy";
import { runModerationPipeline } from "@/lib/moderation/pipeline";
import { MAX_SCREENSHOTS, MAX_SOCIAL_LINKS, MAX_TEAM_MEMBERS } from "@/lib/media";
import { awardXpByRule } from "@/lib/xp";
import {
  isMakerRelationship,
  isProductLaunchStage,
  isProductPlatform,
  isProductPricing,
} from "@/lib/product-hunter";
import type {
  MakerRelationship,
  ProductLaunchStage,
  ProductPlatform,
  ProductPricing,
  SocialLink,
  TeamMember,
} from "@/lib/types";

const COOLDOWN_HOURS = 24;

export interface CreateSubmissionInput {
  type: "product" | "idea";
  title: string;
  tagline: string;
  description: string;
  tags: string[];
  websiteUrl?: string;
  videoUrl?: string;
  logoPath?: string;
  screenshotPaths?: string[];
  team?: TeamMember[];
  socialLinks?: SocialLink[];
  productPlatforms?: ProductPlatform[];
  pricingType?: ProductPricing;
  launchStage?: ProductLaunchStage;
  makerRelationship?: MakerRelationship;
  makerNote?: string;
  feedbackPrompt?: string;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function createSubmission(
  input: CreateSubmissionInput
): Promise<{ error: string } | { submissionId: string; published: boolean }> {
  const t = await getTranslations("errors");
  const title = input.title.trim();
  const tagline = input.tagline.trim();
  const description = input.description.trim();

  if (title.length < 2 || title.length > (input.type === "product" ? 60 : 100)) {
    return { error: t(input.type === "product" ? "productTitleLength" : "titleLength") };
  }
  if (tagline.length < 2 || tagline.length > (input.type === "product" ? 60 : 140)) {
    return { error: t(input.type === "product" ? "productTaglineLength" : "taglineLength") };
  }
  if (description.length < 10 || description.length > 5000) return { error: t("descriptionLength") };

  const websiteUrl = input.websiteUrl?.trim() || null;
  if (websiteUrl && (!isValidHttpUrl(websiteUrl) || websiteUrl.length > 300)) {
    return { error: t("websiteUrlInvalid") };
  }
  const videoUrl = input.videoUrl?.trim() || null;
  if (videoUrl && (!isValidHttpUrl(videoUrl) || videoUrl.length > 300)) {
    return { error: t("videoUrlInvalid") };
  }

  const team = (input.team ?? []).slice(0, MAX_TEAM_MEMBERS).map((member) => ({
    name: member.name.trim().slice(0, 60),
    role: member.role.trim().slice(0, 60),
    link: member.link?.trim() ? member.link.trim().slice(0, 300) : undefined,
  }));
  if (team.some((member) => !member.name || !member.role)) {
    return { error: t("teamMemberRequired") };
  }
  if (team.some((member) => member.link && !isValidHttpUrl(member.link))) {
    return { error: t("teamLinkInvalid") };
  }

  const socialLinks = (input.socialLinks ?? []).slice(0, MAX_SOCIAL_LINKS).map((link) => ({
    label: link.label.trim().slice(0, 30),
    url: link.url.trim().slice(0, 300),
  }));
  if (socialLinks.some((link) => !link.label || !link.url || !isValidHttpUrl(link.url))) {
    return { error: t("socialLinkInvalid") };
  }

  const profile = await getCurrentProfile();
  if (!profile) return { error: t("notSignedIn") };

  const logoPath = input.logoPath?.trim() || null;
  if (logoPath && !logoPath.startsWith(`${profile.id}/`)) {
    return { error: t("logoNotOwned") };
  }
  const screenshotPaths = (input.screenshotPaths ?? []).slice(0, MAX_SCREENSHOTS);
  if (screenshotPaths.some((path) => !path.startsWith(`${profile.id}/`))) {
    return { error: t("screenshotNotOwned") };
  }

  const productPlatforms = [...new Set(input.productPlatforms ?? [])].filter(isProductPlatform);
  const pricingType = input.pricingType && isProductPricing(input.pricingType) ? input.pricingType : null;
  const launchStage = input.launchStage && isProductLaunchStage(input.launchStage) ? input.launchStage : null;
  const makerRelationship =
    input.makerRelationship && isMakerRelationship(input.makerRelationship) ? input.makerRelationship : null;
  const makerNote = input.makerNote?.trim().slice(0, 1200) || null;
  const feedbackPrompt = input.feedbackPrompt?.trim().slice(0, 500) || null;

  if (input.type === "product") {
    if (!websiteUrl) return { error: t("productWebsiteRequired") };
    if (!logoPath) return { error: t("productLogoRequired") };
    if (screenshotPaths.length === 0) return { error: t("productScreenshotRequired") };
    if (productPlatforms.length === 0) return { error: t("productPlatformRequired") };
    if (!pricingType || !launchStage || !makerRelationship) return { error: t("productDetailsRequired") };
  }

  // 新的社区产品投稿走审核和重复检测，不沿用旧 imAihunt 对全部投稿统一施加的 24 小时冷却。
  if (input.type === "idea" && profile.submissionCooldownUntil && new Date(profile.submissionCooldownUntil) > new Date()) {
    return {
      error: t("submitCooldown", {
        until: new Date(profile.submissionCooldownUntil).toLocaleString(await getLocale()),
      }),
    };
  }
  if (await isBlacklisted(profile.id)) {
    return { error: t("blacklistedSubmit") };
  }

  const tags = normalizeTags(input.tags);
  if (input.type === "product" && tags.length === 0) return { error: t("productTagRequired") };

  const supabase = await createClient();
  const admin = createAdminClient();
  if (input.type === "product" && websiteUrl) {
    // 待审核投稿对其他普通用户不可见，因此必须用服务端管理员客户端做全量重复检测。
    const { data: duplicate, error: duplicateError } = await admin
      .from("submissions")
      .select("id")
      .eq("type", "product")
      .eq("website_url", websiteUrl)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (duplicateError) {
      console.error("[createSubmission] 检查重复产品失败:", duplicateError);
      return { error: t("submitFailed") };
    }
    if (duplicate) return { error: t("productAlreadySubmitted") };
  }

  const { data: inserted, error } = await supabase
    .from("submissions")
    .insert({
      type: input.type,
      title,
      tagline,
      description,
      tags,
      submitted_by: profile.id,
      website_url: websiteUrl,
      video_url: videoUrl,
      logo_path: logoPath,
      screenshot_paths: screenshotPaths,
      team,
      social_links: socialLinks,
      product_platforms: input.type === "product" ? productPlatforms : [],
      pricing_type: input.type === "product" ? pricingType : null,
      launch_stage: input.type === "product" ? launchStage : null,
      maker_relationship: input.type === "product" ? makerRelationship : null,
      maker_note: input.type === "product" ? makerNote : null,
      feedback_prompt: input.type === "product" ? feedbackPrompt : null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[createSubmission] 创建投稿失败:", error);
    return { error: t("submitFailed") };
  }

  // admin 发帖天生免审；member 如果被单独授予了 auto_publish_submissions 权限，
  // 自己发的帖子也直接发布——这是叠加在全局审核模式之上的"个人特权"，不进队列。
  if (hasPermission(profile, "auto_publish_submissions")) {
    await admin.from("submissions").update({ status: "published" }).eq("id", inserted.id);
  } else {
    await runModerationPipeline({
      targetType: "submission",
      targetId: inserted.id,
      content: `${title}\n${tagline}\n\n${description}`,
      authorId: profile.id,
    });
  }

  // submission_cooldown_until 现在只有 admin client 能写（见 0004_rls_hardening.sql），
  // 因为普通用户不该能自己清空/改写这一列来绕过冷却。
  if (input.type === "idea") {
    const cooldownUntil = new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    await admin.from("profiles").update({ submission_cooldown_until: cooldownUntil }).eq("id", profile.id);
  }

  // 「不审核」模式下 runModerationPipeline 已经同步把状态改成了 published；
  // 「人工」/「AI」模式这时候还是 pending（AI 的判定是异步的），查一下真实状态再告诉用户。
  const { data: finalRow } = await supabase.from("submissions").select("status").eq("id", inserted.id).maybeSingle();
  const published = finalRow?.status === "published";

  // 发布成功才给经验；还在审核队列里的等审核通过时由 moderateQueueItem 补上。
  // refId = 提交 id，所以两条路径都调用也只会计一次分。
  if (published) {
    after(() =>
      awardXpByRule({
        userId: profile.id,
        action: input.type === "product" ? "submission_product" : "submission_idea",
        refType: "submission",
        refId: inserted.id,
      })
    );
  }

  return { submissionId: inserted.id, published };
}

export async function updateSubmissionStats(
  submissionId: string,
  input: { statsUsers: number; statsDau: number }
): Promise<{ error?: string }> {
  const t = await getTranslations("errors");
  if (!Number.isFinite(input.statsUsers) || input.statsUsers < 0) return { error: t("statsUsersInvalid") };
  if (!Number.isFinite(input.statsDau) || input.statsDau < 0) return { error: t("statsDauInvalid") };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("submissions")
    .update({
      stats_users: Math.round(input.statsUsers),
      stats_dau: Math.round(input.statsDau),
      stats_updated_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  // RLS + 列级 GRANT 已经保证只有作者能改到这一行；没改到行说明不是本人，给个友好提示
  // 而不是让调用方看到一个"成功但什么都没变"的空结果。
  if (!data) return { error: t("submissionNotFoundOrNotOwner") };

  revalidatePath(`/products/${submissionId}`);
  revalidatePath(`/ideas/${submissionId}`);
  return {};
}
