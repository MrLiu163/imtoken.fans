import "server-only";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

// 使用 service_role key 的管理端客户端：绕过 RLS，只能在服务端代码里用（比如钱包登录的验证接口）。
// 千万不要在客户端组件里 import 这个文件。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 环境变量，请先在 .env.local 中配置"
    );
  }

  return createSupabaseJsClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
