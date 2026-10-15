import { notFound } from "next/navigation";
import { CommunityPost } from "@/components/community-preview";
import { DEMO_POSTS, isCommunitySection } from "@/lib/community-demo";

export default async function CommunityPostPage({ params }: { params: Promise<{ section: string; postId: string }> }) {
  const { section, postId } = await params;
  if (!isCommunitySection(section)) notFound();
  const post = DEMO_POSTS.find((item) => item.id === postId && item.section === section);
  if (!post) notFound();
  return <CommunityPost key={post.id} post={post} />;
}
