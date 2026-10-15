const BUCKET = "submission-media";

// submission-media 桶是公开读的，直接拼公开 URL 就行，不需要签名。
export function getSubmissionMediaUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

export const SUBMISSION_MEDIA_BUCKET = BUCKET;
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_SCREENSHOTS = 5;
export const MAX_TEAM_MEMBERS = 8;
export const MAX_SOCIAL_LINKS = 5;
