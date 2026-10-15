import { notFound } from 'next/navigation';
import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { ReviewQueue, type ReviewCase } from '../../../compliance/review-queue';
import { ReviewWorkspace, type Dossier } from './review-workspace';

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
  const dossier = await apiGet<Dossier>(`/applications/${id}/dossier${tenant}`);
  if (!dossier) {
    notFound();
  }
  const item: ReviewCase = {
    id: dossier.id,
    status: dossier.status,
    documentVersion: dossier.documentVersion,
    customer: { legalName: dossier.legalName, customerType: dossier.customerType },
  };
  return (
    <>
      <h2>{dossier.legalName}</h2>
      <ReviewWorkspace dossier={dossier} review={<ReviewQueue cases={[item]} roles={me.roles} />} />
    </>
  );
}
