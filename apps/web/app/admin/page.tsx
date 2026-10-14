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
      <p className="notice">Tenant administration does not include customer identity files.</p>
      <nav className="section-nav">
        <a href="#forms">Required forms</a>
        <a href="#letterhead">Letterhead</a>
        <a href="#segregation">Segregation of duties</a>
        <a href="#operations">Operations</a>
        <a href="#tenants">Staff and retention</a>
      </nav>
      <section id="forms">
        <CategoryForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      </section>
      <section id="letterhead">
        <LetterheadForm tenants={tenants.filter((tenant) => !tenant.isSystem)} templates={templates} />
      </section>
      <section id="segregation">
        <SegregationForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      </section>
      <section id="operations">
        <OperationsForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      </section>
      <section id="tenants">
        <TenantAdminForm tenants={tenants.filter((tenant) => !tenant.isSystem)} />
      </section>
    </Shell>
  );
}
