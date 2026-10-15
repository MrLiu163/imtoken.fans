"use server";

import { randomUUID } from "crypto";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_SIZE_BYTES,
  SUBMISSION_MEDIA_BUCKET,
} from "@/lib/media";

// 客户端用 FormData 调用（不是直接传 File 参数），这是 Server Actions 处理文件上传的标准写法。
export async function uploadSubmissionMedia(formData: FormData): Promise<{ path: string } | { error: string }> {
  const t = await getTranslations("errors");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: t("noFile") };

  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return { error: t("unsupportedImage") };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { error: t("fileTooLarge", { mb: Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024) }) };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const path = `${user.id}/${randomUUID()}.${extension}`;

  const { error } = await supabase.storage.from(SUBMISSION_MEDIA_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { error: error.message };

  return { path };
}

export async function deleteSubmissionMedia(path: string): Promise<{ error?: string }> {
  const t = await getTranslations("errors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t("notSignedIn") };

  // storage 的 delete 策略本身就要求路径第一段目录名等于 auth.uid()，这里再提前拦一道，
  // 不合法的路径直接拒绝，不用等 Storage 那边报错。
  if (!path.startsWith(`${user.id}/`)) return { error: t("noDeletePermission") };

  const { error } = await supabase.storage.from(SUBMISSION_MEDIA_BUCKET).remove([path]);
  if (error) return { error: error.message };
  return {};
}
