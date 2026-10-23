import { requireArea } from '../../../lib/session';
import { InviteForm } from '../../invite-form';
import { ResumeForm } from '../resume-form';
import { TenantPicker } from '../tenant-picker';
import { loadBoard, resolveTenant } from '../load-board';
import { SubmittedApplicationsTable } from '../submitted-applications-table';

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const query = await searchParams;
  const { tenantId, tenants, failed } = await resolveTenant(me, query.tenant);
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const boardTenant = companies.some((tenant) => tenant.id === tenantId) ? tenantId : (companies[0]?.id ?? tenantId);
  const board = failed ? null : await loadBoard('requests', boardTenant);
  const canInvite = me.roles.some((role) => role === 'employee' || role === 'maker' || role === 'super_admin');
  return (
    <>
      <h2>New Request</h2>
      <TenantPicker tenants={companies} tenantId={boardTenant} href="/workspace/requests" />
      {canInvite && me.roles.includes('super_admin') && companies.length === 0 ? (
        <p className="notice">Create an onboarding company under Company Profile before issuing a customer link.</p>
      ) : null}
      {canInvite && !(me.roles.includes('super_admin') && companies.length === 0) ? (
        <>
          <InviteForm companies={companies} />
          <ResumeForm companies={companies} />
        </>
      ) : null}
      {board ? (
        <SubmittedApplicationsTable
          tenantId={boardTenant}
          items={board.items.map((item) => ({
            id: item.id,
            status: item.status,
            legalName: item.legalName,
            customerType: item.customerType,
            submittedAt: (item as { submittedAt?: string | null }).submittedAt ?? null,
          }))}
        />
      ) : (
        <p className="notice error">The request list could not be loaded.</p>
      )}
    </>
  );
}
