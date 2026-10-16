import { requireArea } from '../../../lib/session';
import { SegregationForm } from '../../admin/segregation-form';
import { OperationsForm } from '../../admin/operations-form';
import { TenantAdminForm } from '../../admin/tenant-admin-form';
import { CreateCompanyForm } from '../company/create-company-form';
import { apiGet } from '../../../lib/api';

export default async function SettingsPage() {
  await requireArea(['super_admin']);
  const tenants = (await apiGet<{ id: string; name: string; isSystem: boolean }[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  return (
    <>
      <h2>Settings</h2>
      <p className="notice">Segregation, operations, staff, and retention stay on the existing controls.</p>
      <CreateCompanyForm />
      <SegregationForm tenants={companies} />
      <OperationsForm tenants={companies} />
      <TenantAdminForm tenants={companies} />
    </>
  );
}
