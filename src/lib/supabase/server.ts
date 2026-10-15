import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// 服务端（Server Component / Server Action）使用的 Supabase 客户端。
// 依赖 cookies() 是异步 API（Next.js 16 起），所以这个函数也是异步的。
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 在纯 Server Component 中调用 set 会抛错，只要有 proxy.ts 刷新 session 即可忽略。
          }
        },
      },
    }
  );
}
