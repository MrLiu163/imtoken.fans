import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentProfile } from "@/lib/profile";
import { sanitizeRedirect } from "@/lib/redirect";
import { OnboardingForm } from "@/components/onboarding-form";

// 首次注册/登录后的引导页。已经走过引导（onboarded_at 有值）的人直接放行，
// 免得老用户或刷新页面的人被反复拦在这里。
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const t = await getTranslations("welcome");
  const { redirect: rawRedirect } = await searchParams;
  const redirectTo = sanitizeRedirect(rawRedirect);

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/auth/sign-in?redirect=${encodeURIComponent(`/welcome?redirect=${redirectTo}`)}`);
  if (profile.onboardedAt) redirect(redirectTo);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="font-mono text-xs uppercase tracking-wide text-brand-ink">{t("step")}</p>
      <h1 className="mt-2 text-2xl font-bold text-ink">{t("title")}</h1>
      <p className="mt-1.5 text-sm text-muted">{t("subtitle")}</p>

      <div className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <OnboardingForm
          redirectTo={redirectTo}
          initialDisplayName={profile.displayName ?? profile.username ?? ""}
          initialUsername={profile.username ?? ""}
          initialBio={profile.bio ?? ""}
          initialExpertise={profile.expertise}
          initialAvatarUrl={profile.avatarUrl}
        />
      </div>
    </div>
  );
}
