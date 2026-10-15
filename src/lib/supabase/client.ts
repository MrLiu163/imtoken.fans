import { createBrowserClient } from "@supabase/ssr";

// 浏览器端使用的 Supabase 客户端。
// 需要在 .env.local 中配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY
// （具体步骤见 README「配置 Supabase」章节）后才能正常工作。
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
