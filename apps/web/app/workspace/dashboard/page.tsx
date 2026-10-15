import { requireArea } from '../../../lib/session';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const board = failed ? null : await loadBoard('dashboard', tenantId);
  const suffix = `?tenant=${encodeURIComponent(tenantId)}`;
  return (
    <>
      <h2>Dashboard</h2>
      <TenantPicker tenants={tenants} tenantId={tenantId} href="/workspace/dashboard" />
      {board ? (
        <div className="metrics cards">
          <a href={`/workspace/requests${suffix}`}>
            <span>New requests</span>
            <strong>{board.counts.requests}</strong>
          </a>
          <a href={`/workspace/waiting${suffix}`}>
            <span>Waiting</span>
            <strong>{board.counts.waiting}</strong>
          </a>
          <a href={`/workspace/waiting${suffix}`}>
            <span>Corrections</span>
            <strong>{board.counts.corrections}</strong>
          </a>
          <a href={`/workspace/customers${suffix}`}>
            <span>Approved customers</span>
            <strong>{board.counts.customers}</strong>
          </a>
          <a href={`/workspace/waiting${suffix}`}>
            <span>Overdue</span>
            <strong>{board.counts.overdue}</strong>
          </a>
        </div>
      ) : (
        <p className="notice error">The dashboard could not be loaded.</p>
      )}
    </>
  );
}
