import { requireArea } from '../../../lib/session';
import { QueueTable } from '../queue';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('customers', tenantId);
  return (
    <>
      <h2>Customer List</h2>
      <TenantPicker tenants={tenants} tenantId={tenantId} href="/workspace/customers" />
      {board ? (
        <QueueTable items={board.items} tenantId={tenantId} empty="No approved customers are on file." />
      ) : (
        <p className="notice error">The customer list could not be loaded.</p>
      )}
    </>
  );
}
