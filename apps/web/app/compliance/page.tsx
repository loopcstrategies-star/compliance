import { requireArea } from '../../lib/session';
import { apiGet } from '../../lib/api';
import { Shell } from '../shell';
import { InviteForm } from '../invite-form';
import { ReviewQueue, type ReviewCase } from './review-queue';

export default async function CompliancePage() {
  const me = await requireArea(['maker', 'checker', 'authorised_approver']);
  const cases = (await apiGet<ReviewCase[]>('/applications')) ?? [];
  return (
    <Shell title="Compliance workspace" me={me}>
      {me.roles.includes('maker') ? <InviteForm /> : null}
      <p className="notice">This queue shows the stage assigned to your role.</p>
      <ReviewQueue cases={cases} roles={me.roles} />
    </Shell>
  );
}
