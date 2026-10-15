import { notFound } from "next/navigation";
import { SubmissionDetail } from "@/components/submission-detail";
import {
  getCommentsForSubmission,
  getProductEngagement,
  getSimilarSubmissions,
  getSubmissionCardById,
  getUserVoteFlags,
} from "@/lib/submissions";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submission = await getSubmissionCardById(id, "product");
  if (!submission) notFound();

  const [similar, comments, voteFlags, productEngagement] = await Promise.all([
    getSimilarSubmissions(submission),
    getCommentsForSubmission(submission.id),
    getUserVoteFlags(submission.id),
    getProductEngagement(submission.id),
  ]);

  return (
    <SubmissionDetail
      submission={submission}
      similar={similar}
      comments={comments}
      voteFlags={voteFlags}
      productEngagement={productEngagement}
    />
  );
}
