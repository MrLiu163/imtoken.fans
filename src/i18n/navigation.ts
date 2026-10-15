import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// 全站的 Link / router.push / redirect 都要走这几个包装过的版本，
// 才能自动带上当前语言前缀（/zh/... 或 /en/...），不然切语言之后链接会跳错语言。
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
