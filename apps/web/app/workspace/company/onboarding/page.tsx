import { requireArea } from '../../../../lib/session';
import { apiGet } from '../../../../lib/api';
import { CreateCompanyForm } from '../create-company-form';

type TenantRow = { id: string; name: string; isSystem: boolean; createdAt: string };

export default async function CompanyOnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; created?: string }>;
}) {
  await requireArea(['super_admin']);
  const query = await searchParams;
  const tenants = (await apiGet<TenantRow[]>('/tenants')) ?? [];
  const companies = tenants.filter((tenant) => !tenant.isSystem);
  const selected = companies.find((tenant) => tenant.id === query.tenant) ?? companies[0];
  const justCreated = query.created === '1' && Boolean(selected) && selected?.id === query.tenant;
  const requestsHref = selected
    ? `/workspace/requests?tenant=${encodeURIComponent(selected.id)}`
    : '/workspace/requests';

  return (
    <>
      <nav className="company-breadcrumb" aria-label="Breadcrumb">
        <a href="/workspace/company">Company Profile</a>
        <span aria-hidden="true"> / </span>
        <span>Customer onboarding</span>
      </nav>

      <header className="dash-head company-profile-head">
        <div>
          <h2>Create onboarding company</h2>
        </div>
      </header>

      <section className="panel">
        <h3>Create onboarding company</h3>
        {justCreated && selected ? (
          <div className="notice success company-created-banner" role="status">
            <p>Company created successfully.</p>
            <a className="button-link" href={requestsHref}>
              Open New Request
            </a>
          </div>
        ) : null}
        <CreateCompanyForm />
      </section>

      <section className="panel workflow-gap">
        <h3>Onboarding companies</h3>
        {companies.length === 0 ? (
          <p className="notice">No onboarding companies yet. Create one above to get started.</p>
        ) : (
          <div className="company-table-wrap">
            <table className="company-table">
              <thead>
                <tr>
                  <th scope="col">Company</th>
                  <th scope="col">Created</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => (
                  <tr key={company.id} className={company.id === selected?.id ? 'is-selected' : undefined}>
                    <td>{company.name}</td>
                    <td>{formatCreatedAt(company.createdAt)}</td>
                    <td className="company-table-actions">
                      <a
                        className="button-link button-link--outline"
                        href={`/workspace/requests?tenant=${encodeURIComponent(company.id)}`}
                      >
                        Open New Request
                      </a>
                      <a href={`/workspace/company/branding?tenant=${encodeURIComponent(company.id)}`}>
                        Use for branding
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
