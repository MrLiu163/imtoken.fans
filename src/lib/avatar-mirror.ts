import "server-only";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  SUBMISSION_MEDIA_BUCKET,
  getSubmissionMediaUrl,
} from "@/lib/media";

// Google 登录带过来的头像是 lh3.googleusercontent.com 的外链，浏览器直连它在国内经常拉不到，
// 于是页面上就是一个裂图。这里在登录回调时把外链头像抓回来存进我们自己的 Supabase Storage，
// profiles.avatar_url 一并改写成自己的地址，之后所有页面都只加载同源可控的图片。
const FETCH_TIMEOUT_MS = 6000;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// 已经在我们自己 Storage 上的（用户手动上传的、或上次已经镜像过的）就不用再动了。
export function isSelfHostedImage(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(base) && url.startsWith(`${base}/storage/v1/object/public/`);
}

/**
 * 把外链头像镜像到 Storage，返回新的公开 URL；不需要镜像或镜像失败时返回 null。
 * 失败一律吞掉（只打日志）——头像镜像不该阻断登录流程。
 */
export async function mirrorExternalAvatar(
  userId: string,
  sourceUrl: string | null | undefined
): Promise<string | null> {
  if (!sourceUrl || isSelfHostedImage(sourceUrl)) return null;

  // 用户可编辑 avatar_url。只镜像 Google 头像主机，禁止凭证、自定义端口及跳转，
  // 防止 OAuth 回调变成任意 URL / 内网抓取入口。
  let source: URL;
  try {
    source = new URL(sourceUrl);
  } catch {
    return null;
  }
  if (
    source.protocol !== "https:" || source.username || source.password ||
    (source.port && source.port !== "443") ||
    !/^lh[0-9]+\.googleusercontent\.com$/.test(source.hostname)
  ) return null;

  try {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "error",
      // 服务端抓图不需要带任何身份，也不要让 CDN 因为 Referer 拒绝我们。
      referrer: "",
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[avatar-mirror] 抓取失败 ${response.status}`);
      return null;
    }

    const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_UPLOAD_MIME_TYPES.includes(contentType)) {
      console.warn(`[avatar-mirror] 不支持的类型 ${contentType}`);
      return null;
    }

    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_UPLOAD_SIZE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    if (size === 0) return null;
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    // 路径第一段必须是 userId，跟 submission-media 桶现有的 Storage 策略保持一致。
    // 文件名带源地址的哈希，Google 换头像时路径也会变，不会被 CDN 缓存住旧图。
    const digest = createHash("sha1").update(sourceUrl).digest("hex").slice(0, 12);
    const path = `${userId}/avatar-${digest}.${EXTENSION_BY_MIME[contentType]}`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from(SUBMISSION_MEDIA_BUCKET)
      .upload(path, bytes, { contentType, upsert: true });
    if (uploadError) {
      console.warn(`[avatar-mirror] 上传失败: ${uploadError.message}`);
      return null;
    }

    const publicUrl = getSubmissionMediaUrl(path);
    const { error: updateError } = await admin
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", userId);
    if (updateError) {
      console.warn(`[avatar-mirror] 写回 profiles 失败: ${updateError.message}`);
      return null;
    }

    return publicUrl;
  } catch {
    console.warn("[avatar-mirror] 镜像头像失败");
    return null;
  }
}
