import { useTranslations } from "next-intl";
export default function CommunityLoading() {
  const t = useTranslations("community");
  return <div className="community-shell community-loading" role="status" aria-label={t("loading")}>{Array.from({ length: 6 }, (_, index) => <div className="community-skeleton" key={index}><i /><span /><span /><span /></div>)}</div>;
}
