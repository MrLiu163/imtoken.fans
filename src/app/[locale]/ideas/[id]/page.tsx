import { notFound } from "next/navigation";
import { SubmissionDetail } from "@/components/submission-detail";
import {
  getCommentsForSubmission,
  getSimilarSubmissions,
  getSubmissionCardById,
  getUserVoteFlags,
} from "@/lib/submissions";

export default async function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await getSubmissionCardById(id, "idea");
  if (!submission) notFound();

  const [similar, comments, voteFlags] = await Promise.all([
    getSimilarSubmissions(submission),
    getCommentsForSubmission(submission.id),
    getUserVoteFlags(submission.id),
  ]);

  return <SubmissionDetail submission={submission} similar={similar} comments={comments} voteFlags={voteFlags} />;
}
