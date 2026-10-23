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
  const requestsHref = selected
    ? `/workspace/requests?tenant=${encodeURIComponent(selected.id)}`
    : '/workspace/requests';

  return (
    <>
      <h2>Company Profile</h2>
      <p className="notice">
        This page has two separate workflows. Create an onboarding company for customer invitations, then upload this company&apos;s own brand images for document use.
      </p>

      <section className="panel" id="onboarding-companies">
        <h2>Onboarding companies</h2>
        <p className="notice">
          Use this workflow to create a company that can receive customer applications. After you create it, open New Request, choose the company, issue an invitation link, and share that link with the customer.
        </p>
        <CreateCompanyForm />
        {companies.length === 0 ? <p className="notice">No onboarding company is available yet. Create one above before inviting customers.</p> : null}
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
        {companies.length > 0 ? (
          <p className="notice success">
            Next step: go to <a href={requestsHref}>New Request</a> to issue a customer invitation link for the selected company.
          </p>
        ) : null}
        {selected ? (
          <section id="copy">
            <CloneForm tenantId={selected.id} tenantName={selected.name} />
          </section>
        ) : null}
      </section>

      <section className="panel workflow-gap" id="company-assets-workflow">
        <h2>Company attachments</h2>
        <p className="notice">
          This workflow is separate from invitations. Upload logo, stamp, letterhead, and authorised signature images for this company&apos;s own document branding.
        </p>
        {selected ? (
          <CompanyAssetsForm
            key={selected.id}
            tenantId={selected.id}
            tenantName={selected.name}
            initialAssets={loadedAssets ?? []}
            assetsLoaded={loadedAssets !== null}
          />
        ) : (
          <p className="notice">Select or create an onboarding company above before uploading company attachments.</p>
        )}
      </section>
    </>
  );
}
