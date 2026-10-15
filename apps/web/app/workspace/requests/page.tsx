import { requireArea } from '../../../lib/session';
import { InviteForm } from '../../invite-form';
import { ResumeForm } from '../resume-form';
import { QueueTable } from '../queue';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('requests', tenantId);
  return (
    <>
      <h2>New Request</h2>
      <TenantPicker tenants={tenants} tenantId={tenantId} href="/workspace/requests" />
      {me.roles.includes('maker') ? (
        <>
          <InviteForm />
          <ResumeForm />
        </>
      ) : null}
      {board ? (
        <QueueTable items={board.items} tenantId={tenantId} empty="No submitted requests are waiting for a first review." />
      ) : (
        <p className="notice error">The request list could not be loaded.</p>
      )}
    </>
  );
}
