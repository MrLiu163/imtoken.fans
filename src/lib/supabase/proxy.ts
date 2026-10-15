import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "./config";

// 在 Proxy（Next.js 16 里 middleware 改名为 proxy）里刷新 Supabase 的 session cookie，
// 这样 access token 过期后用户不会莫名其妙被登出。
// 参考 @supabase/ssr 官方文档的写法：createServerClient 和 getUser() 之间不要插入其它逻辑。
//
// baseResponse 是 next-intl 中间件已经决定好的响应（可能是重定向/rewrite），
// 这里只往上面叠加 Supabase 的 cookie，不能像以前那样自己重新 new 一个 NextResponse.next()
// ——那样会把 next-intl 的重定向结果丢掉。
export async function updateSession(request: NextRequest, baseResponse: NextResponse) {
  if (!isSupabaseConfigured()) {
    return baseResponse;
  }

  let supabaseResponse = baseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  // 上面这段 setAll 只有在 Supabase 真的要刷新 cookie 时才会触发，且触发时会重建
  // supabaseResponse——如果重建了，就会把 baseResponse 里 next-intl 的重定向/rewrite 丢掉。
  // 所以：cookie 有变化时，把变化过的 cookie 挪到 baseResponse 上，仍然返回 baseResponse。
  if (supabaseResponse !== baseResponse) {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      baseResponse.cookies.set(cookie);
    });
  }

  return baseResponse;
}
