import { notFound } from "next/navigation";
import { CommunityBoard } from "@/components/community-preview";
import { SECTION_CATEGORIES, isCommunitySection } from "@/lib/community-demo";

export default async function CommunityBoardPage({ params, searchParams }: { params: Promise<{ section: string }>; searchParams: Promise<{ category?: string; idea?: string }> }) {
  const { section } = await params;
  if (!isCommunitySection(section)) notFound();
  const search = await searchParams;
  const initialCategory = section === "feedback" && search.category && SECTION_CATEGORIES.feedback.includes(search.category) ? search.category : "all";
  return <CommunityBoard key={section} section={section} initialCategory={initialCategory} initialId={search.idea ?? null} />;
}
