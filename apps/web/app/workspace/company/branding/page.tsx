import { requireArea } from '../../../../lib/session';
import { apiGet } from '../../../../lib/api';
import { CompanySelector } from '../company-selector';
import { CompanyAssetsForm, type CompanyAssetSummary } from '../company-assets-form';

type TenantRow = { id: string; name: string; isSystem: boolean };

export default async function CompanyBrandingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  await requireArea(['super_admin']);
  const query = await searchParams;
  const tenants = (await apiGet<TenantRow[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const selected = companies.find((tenant) => tenant.id === query.tenant) ?? companies[0];
  const loadedAssets = selected ? await apiGet<CompanyAssetSummary[]>(`/tenants/${selected.id}/company-assets`) : [];

  return (
    <>
      <nav className="company-breadcrumb" aria-label="Breadcrumb">
        <a href="/workspace/company">Company Profile</a>
        <span aria-hidden="true"> / </span>
        <span>Company branding</span>
      </nav>

      <header className="dash-head company-profile-head">
        <div>
          <h2>Company branding</h2>
        </div>
      </header>

      {companies.length === 0 ? (
        <section className="panel">
          <p className="notice">
            No onboarding company is available yet.{' '}
            <a href="/workspace/company/onboarding">Create onboarding company</a>
          </p>
        </section>
      ) : (
        <section className="panel">
          <CompanySelector
            companies={companies}
            selectedId={selected?.id}
            label="Company"
            basePath="/workspace/company/branding"
          />
          {selected ? (
            <CompanyAssetsForm
              key={selected.id}
              tenantId={selected.id}
              tenantName={selected.name}
              initialAssets={loadedAssets ?? []}
              assetsLoaded={loadedAssets !== null}
            />
          ) : null}
        </section>
      )}
    </>
  );
}
