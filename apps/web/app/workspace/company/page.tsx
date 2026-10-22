import { requireArea } from '../../../lib/session';
import { apiGet } from '../../../lib/api';
import { CloneForm } from './clone-form';
import { CreateCompanyForm } from './create-company-form';
import { CompanyAssetsForm, type CompanyAssetSummary } from './company-assets-form';

export default async function CompanyPage({ searchParams }: { searchParams: Promise<{ tenant?: string }> }) {
  await requireArea(['super_admin']);
  const query = await searchParams;
  const tenants = (await apiGet<{ id: string; name: string; isSystem: boolean }[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const selected = companies.find((tenant) => tenant.id === query.tenant) ?? companies[0];
  const loadedAssets = selected ? await apiGet<CompanyAssetSummary[]>(`/tenants/${selected.id}/company-assets`) : [];

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
      {selected ? (
        <CompanyAssetsForm
          key={selected.id}
          tenantId={selected.id}
          tenantName={selected.name}
          initialAssets={loadedAssets ?? []}
          assetsLoaded={loadedAssets !== null}
        />
      ) : null}
      {selected ? (
        <section id="copy">
          <CloneForm tenantId={selected.id} tenantName={selected.name} />
        </section>
      ) : null}
    </>
  );
}
