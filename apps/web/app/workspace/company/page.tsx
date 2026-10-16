import { requireArea } from '../../../lib/session';
import { apiGet } from '../../../lib/api';
import { CategoryForm } from '../../admin/category-form';
import { LetterheadForm } from '../../admin/letterhead-form';
import { SegregationForm } from '../../admin/segregation-form';
import { OperationsForm } from '../../admin/operations-form';
import { TenantAdminForm } from '../../admin/tenant-admin-form';
import { CloneForm } from './clone-form';
import { CreateCompanyForm } from './create-company-form';
import { CompanyKycPanel } from './company-kyc';
import { ProfileForm, type CompanyProfile } from './profile-form';

type KycProfile = {
  status: string;
  reviewedAt: string | null;
  updatedAt: string | null;
  answers: { fieldKey: string; value: unknown }[];
  evidence: { id: string; documentType: string; expiresOn: string | null }[];
  grants: { id: string; recipientName: string; expiresAt: string; revokedAt: string | null }[];
};
type TemplateStatus = {
  templateId: string;
  letterheadOwner: string;
  pageCount: number;
  blocked: boolean;
  blockedFieldCount: number;
  unresolvedPlacementCount: number;
};

export default async function CompanyPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  await requireArea(['super_admin']);
  const query = await searchParams;
  const tenants = (await apiGet<{ id: string; name: string; isSystem: boolean }[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const selected = companies.find((tenant) => tenant.id === query.tenant) ?? companies[0];
  const templates = (await apiGet<TemplateStatus[]>('/templates')) ?? [];
  const profile = selected ? await apiGet<CompanyProfile>(`/tenants/${selected.id}/profile`) : null;
  const companyKyc = selected ? await apiGet<KycProfile>(`/tenants/${selected.id}/company-kyc`) : null;

  return (
    <>
      <h2>Company Profile</h2>
      <CreateCompanyForm />
      {companies.length === 0 ? <p className="notice">No onboarding company is available.</p> : null}
      {selected ? (
        <p>
          Showing <strong>{selected.name}</strong>.{' '}
          {companies.map((tenant) => (
            <a key={tenant.id} href={`/workspace/company?tenant=${tenant.id}`}>
              {tenant.name}{' '}
            </a>
          ))}
        </p>
      ) : null}
      {profile ? <ProfileForm profile={profile} /> : selected ? <p className="notice error">The company profile could not be loaded.</p> : null}
      {selected && companyKyc ? <CompanyKycPanel tenantId={selected.id} profile={companyKyc} /> : null}
      {selected ? (
        <section id="copy">
          <CloneForm tenantId={selected.id} tenantName={selected.name} />
        </section>
      ) : null}
      <section id="templates">
        <h2>Template readiness</h2>
        {templates.length === 0 ? <p className="notice error">Template status could not be loaded.</p> : null}
        {templates.map((template) => (
          <p key={template.templateId} className={template.blocked ? 'notice error' : 'notice success'}>
            {template.templateId}: {template.blockedFieldCount} answer slots blocked, {template.unresolvedPlacementCount} placements unresolved, letterhead owner {template.letterheadOwner}. Generation stays blocked while a required slot is unresolved.
          </p>
        ))}
      </section>
      <section id="forms">
        <CategoryForm tenants={companies} />
      </section>
      <section id="letterhead">
        <LetterheadForm tenants={companies} templates={templates} />
      </section>
      <section id="segregation">
        <SegregationForm tenants={companies} />
      </section>
      <section id="operations">
        <OperationsForm tenants={companies} />
      </section>
      <section id="tenants">
        <TenantAdminForm tenants={companies} />
      </section>
    </>
  );
}
