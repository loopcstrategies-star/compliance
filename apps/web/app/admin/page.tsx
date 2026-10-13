import { requireArea } from '../../lib/session';
import { apiGet } from '../../lib/api';
import { Shell } from '../shell';
import { CategoryForm } from './category-form';
import { LetterheadForm } from './letterhead-form';
import { SegregationForm } from './segregation-form';
import { OperationsForm } from './operations-form';
import { TenantAdminForm } from './tenant-admin-form';

export default async function AdminPage() {
  const me = await requireArea(['super_admin']);
  const tenants = (await apiGet<{ id: string; name: string; isSystem: boolean }[]>('/tenants')) ?? [];
  const templates =
    (await apiGet<{ templateId: string; letterheadOwner: string; pageCount: number }[]>('/templates')) ?? [];
  return (
    <Shell title="Super-admin" me={me}>
      <p>Tenant administration does not include customer identity files.</p>
      <CategoryForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      <LetterheadForm tenants={tenants.filter((tenant) => !tenant.isSystem)} templates={templates} />
      <SegregationForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      <OperationsForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      <TenantAdminForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
    </Shell>
  );
}
