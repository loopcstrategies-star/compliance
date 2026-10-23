import { requireArea } from '../../../lib/session';
import { apiGet } from '../../../lib/api';
import { CloneForm } from './clone-form';
import { CreateCompanyForm } from './create-company-form';
import { CompanySelector } from './company-selector';
import { CompanyAssetsForm, type CompanyAssetSummary } from './company-assets-form';

export default async function CompanyPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; created?: string }>;
}) {
  await requireArea(['super_admin']);
  const query = await searchParams;
  const tenants = (await apiGet<{ id: string; name: string; isSystem: boolean }[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const selected = companies.find((tenant) => tenant.id === query.tenant) ?? companies[0];
  const justCreated = query.created === '1' && Boolean(selected) && selected?.id === query.tenant;
  const loadedAssets = selected ? await apiGet<CompanyAssetSummary[]>(`/tenants/${selected.id}/company-assets`) : [];
  const requestsHref = selected
    ? `/workspace/requests?tenant=${encodeURIComponent(selected.id)}`
    : '/workspace/requests';

  return (
    <>
      <header className="dash-head company-profile-head">
        <div>
          <h2>Company Profile</h2>
          <p>
            Two separate workflows: create an onboarding company for customer invitations, or upload brand images for a
            company&apos;s own documents.
          </p>
        </div>
      </header>

      <section className="workflow-overview" aria-label="Company Profile workflows">
        <article className="workflow-card">
          <span className="workflow-step">01</span>
          <h3>Customer onboarding</h3>
          <p>Create a company that can receive applications, then issue a one-time invitation from New Request and share it manually.</p>
          <a href="#workflow-onboarding">Go to onboarding</a>
        </article>
        <article className="workflow-card">
          <span className="workflow-step">02</span>
          <h3>Company-owned document branding</h3>
          <p>Upload logo, stamp, letterhead, and authorised signature for the selected company&apos;s own records and documents.</p>
          <a href="#workflow-branding">Go to branding</a>
        </article>
      </section>

      <section className="panel workflow-gap" id="workflow-onboarding">
        <div className="panel-head">
          <div>
            <p className="workflow-section-label">Workflow 01</p>
            <h2>Customer onboarding</h2>
          </div>
        </div>
        <p className="notice">
          Create a company that can receive customer applications. After creation, open New Request for that company, create
          a one-time invitation link, and share it with the customer yourself. Invitations are not sent automatically.
        </p>

        {justCreated && selected ? (
          <div className="notice success company-created-banner" role="status">
            <p>
              <strong>{selected.name}</strong> is ready. Select it below if needed, then open New Request to issue a
              one-time invitation and share that link with the customer.
            </p>
            <a className="button-link" href={requestsHref}>
              Open New Request
            </a>
          </div>
        ) : null}

        <CreateCompanyForm />

        {companies.length === 0 ? (
          <p className="notice">No onboarding company is available yet. Create one above before inviting customers.</p>
        ) : (
          <CompanySelector companies={companies} selectedId={selected?.id} label="Active onboarding company" />
        )}

        {companies.length > 0 && selected && !justCreated ? (
          <p className="notice">
            Next step for <strong>{selected.name}</strong>: go to <a href={requestsHref}>New Request</a> to issue a
            customer invitation link.
          </p>
        ) : null}

        {selected ? (
          <details className="company-secondary" id="copy">
            <summary>Create from existing configuration</summary>
            <p className="notice">
              Optional admin action: copy configuration into a new company. This does not invite a customer.
            </p>
            <CloneForm tenantId={selected.id} tenantName={selected.name} />
          </details>
        ) : null}
      </section>

      <section className="panel workflow-gap" id="workflow-branding">
        <div className="panel-head">
          <div>
            <p className="workflow-section-label">Workflow 02</p>
            <h2>Company-owned document branding</h2>
          </div>
        </div>
        <p className="notice">
          These images are for the selected company&apos;s own records and documents. They do not invite customers.
        </p>
        {companies.length > 0 ? (
          <CompanySelector companies={companies} selectedId={selected?.id} label="Company that owns these assets" />
        ) : null}
        {selected ? (
          <CompanyAssetsForm
            key={selected.id}
            tenantId={selected.id}
            tenantName={selected.name}
            initialAssets={loadedAssets ?? []}
            assetsLoaded={loadedAssets !== null}
          />
        ) : (
          <p className="notice">Select or create an onboarding company above before uploading branding assets.</p>
        )}
      </section>
    </>
  );
}
