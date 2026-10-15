import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { AuthProvider } from "@/lib/auth-context";
import { AnalyticsTracker } from "@/components/analytics-tracker";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// 面向普通用户的页面才走这层：双语 Provider + 站点导航/页脚，管理后台不经过这里（见根 layout 的注释）。
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // 告诉 next-intl 这个请求用哪个语言渲染（服务端组件里 useTranslations 靠这个拿到正确文案）。
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <AuthProvider>
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <AnalyticsTracker />
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
