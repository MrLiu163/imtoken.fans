// 只允许站内路径；URL 解析会将反斜杠和控制字符归一化，不能仅检查 //。
export function sanitizeRedirect(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || /[\\\u0000-\u0020\u007f]/.test(path)) return "/";
  try {
    const base = "https://redirect.invalid";
    const url = new URL(path, base);
    return url.origin === base && !url.pathname.startsWith("//") ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
