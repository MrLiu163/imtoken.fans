import { notFound } from "next/navigation";
import { CommunityBoard } from "@/components/community-preview";
import { isCommunitySection } from "@/lib/community-demo";

export default async function CommunityBoardPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isCommunitySection(section)) notFound();
  return <CommunityBoard key={section} section={section} />;
}
