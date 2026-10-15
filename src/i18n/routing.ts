import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["zh", "en"],
  defaultLocale: "zh",
  // 两个语言都要带前缀（/zh/... 和 /en/...），不给默认语言免前缀特权。
  localePrefix: "always",
  // 没有 cookie 记录时，按浏览器 Accept-Language 自动判断进 /zh 还是 /en。
  localeDetection: true,
});

export type AppLocale = (typeof routing.locales)[number];
