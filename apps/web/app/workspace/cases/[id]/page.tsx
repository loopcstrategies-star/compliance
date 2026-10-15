import { notFound } from 'next/navigation';
import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { ReviewQueue, type ReviewCase } from '../../../compliance/review-queue';

type Summary = ReviewCase & {
  legalName: string;
  customerType: string;
  assignee: string;
  createdAt: string;
  statusChangedAt: string;
};

export default async function CasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const { id } = await params;
  const query = await searchParams;
  const tenant = query.tenant ? `?tenantId=${encodeURIComponent(query.tenant)}` : '';
  const summary = await apiGet<Summary>(`/applications/${id}/summary${tenant}`);
  if (!summary) {
    notFound();
  }
  const item: ReviewCase = {
    id: summary.id,
    status: summary.status,
    documentVersion: summary.documentVersion,
    customer: { legalName: summary.legalName, customerType: summary.customerType },
  };
  return (
    <>
      <h2>{summary.legalName}</h2>
      <p className="notice">
        {summary.customerType.replaceAll('_', ' ')} · {summary.status.replaceAll('_', ' ')} · assignee {summary.assignee || 'unassigned'}
      </p>
      <ReviewQueue cases={[item]} roles={me.roles} />
    </>
  );
}
