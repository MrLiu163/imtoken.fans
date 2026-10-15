import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isAddress } from "viem";
import { routing } from "@/i18n/routing";
import { buildChallengeMessage, createChallengeCookieValue, WALLET_NONCE_COOKIE } from "@/lib/wallet";

// /api/* 被排除在 next-intl 的路由之外（见 src/proxy.ts），所以这里拿不到 URL 上的语言，
// 由客户端在 body 里显式带上 locale；给 getTranslations 显式传 locale 就能翻出对应语言。
function pickLocale(raw: unknown): string {
  return typeof raw === "string" && routing.locales.includes(raw as (typeof routing.locales)[number])
    ? raw
    : routing.defaultLocale;
}

export async function POST(request: Request) {
  let body: { address?: unknown; locale?: unknown };
  try {
    body = await request.json();
  } catch {
    const tFallback = await getTranslations({ locale: routing.defaultLocale, namespace: "errors" });
    return NextResponse.json({ error: tFallback("badRequest") }, { status: 400 });
  }

  const { address } = body;
  const locale = pickLocale(body.locale);
  const t = await getTranslations({ locale, namespace: "errors" });

  if (typeof address !== "string" || !isAddress(address)) {
    return NextResponse.json({ error: t("invalidWalletAddress") }, { status: 400 });
  }

  let cookieValue: string;
  let message: string;
  try {
    const created = createChallengeCookieValue(address, locale);
    cookieValue = created.cookieValue;
    message = buildChallengeMessage(created.challenge);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : t("nonceCreateFailed") },
      { status: 500 }
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(WALLET_NONCE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return NextResponse.json({ message });
}
