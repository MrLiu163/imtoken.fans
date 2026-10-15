// 「用户名 + 密码」登录：不需要真实邮箱，注册后不用等邮件验证就能直接登录。
// 实现方式是给每个用户名映射一个固定格式的内部邮箱（同一个用户名永远映射到同一个邮箱），
// 底层还是用 Supabase 的邮箱/密码认证，只是这个邮箱用户从来看不到。

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  return USERNAME_PATTERN.test(normalized) ? normalized : null;
}

export function usernameSyntheticEmail(username: string): string {
  return `${username}@users.imaihunt.internal`;
}
