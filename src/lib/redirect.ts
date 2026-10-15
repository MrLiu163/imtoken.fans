// 校验登录成功后要跳转的地址，只允许站内相对路径，防止 open redirect。
export function sanitizeRedirect(path: string | null | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}
