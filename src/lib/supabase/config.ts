// 判断 Supabase 是否已经配置好真实凭证。
// NEXT_PUBLIC_ 前缀的变量会在构建时被内联，所以这个函数在浏览器端和服务端都能用。
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
