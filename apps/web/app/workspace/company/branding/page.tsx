import { requireArea } from '../../../../lib/session';
import { apiGet } from '../../../../lib/api';
import { CompanyAssetsForm, type CompanyAssetSummary } from '../company-assets-form';

export default async function CompanyBrandingPage() {
  await requireArea(['super_admin']);
  const loadedAssets = await apiGet<CompanyAssetSummary[]>('/platform/company-assets');

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

      <section className="panel">
        <CompanyAssetsForm initialAssets={loadedAssets ?? []} assetsLoaded={loadedAssets !== null} />
      </section>
    </>
  );
}
