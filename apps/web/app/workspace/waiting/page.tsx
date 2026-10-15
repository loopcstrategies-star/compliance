import { requireArea } from '../../../lib/session';
import { QueueTable } from '../queue';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';

export default async function WaitingPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('waiting', tenantId);
  return (
    <>
      <h2>Waiting List</h2>
      <p className="notice">Overdue uses the company operations hours and the time the status last changed.</p>
      <TenantPicker tenants={tenants} tenantId={tenantId} href="/workspace/waiting" />
      {board ? (
        <QueueTable items={board.items} tenantId={tenantId} empty="No applications are waiting in review." showOverdue />
      ) : (
        <p className="notice error">The waiting list could not be loaded.</p>
      )}
    </>
  );
}
