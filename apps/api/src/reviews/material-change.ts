import type { Tx } from '../prisma/prisma.service';

const OPEN_REVIEW = new Set(['submitted', 'maker_review', 'checker_review']);

export async function supersedeIfMaterial(
  tx: Tx,
  application: { id: string; status: string },
): Promise<void> {
  const next = application.status === 'approved' ? 'reassessment' : OPEN_REVIEW.has(application.status) ? 'correction' : null;
  if (!next) {
    return;
  }
  const now = new Date();
  const open = await tx.submission.findMany({
    where: { applicationId: application.id, supersededAt: null },
    select: { id: true },
  });
  if (open.length > 0) {
    await tx.reviewDecision.updateMany({
      where: { submissionId: { in: open.map((row) => row.id) }, supersededAt: null },
      data: { supersededAt: now },
    });
    await tx.submission.updateMany({
      where: { id: { in: open.map((row) => row.id) } },
      data: { supersededAt: now },
    });
  }
  await tx.application.update({
    where: { id: application.id },
    data: { status: next, documentVersion: { increment: 1 }, statusChangedAt: new Date() },
  });
}
