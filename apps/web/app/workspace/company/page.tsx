import { requireArea } from '../../../lib/session';

export default async function CompanyPage() {
  await requireArea(['super_admin']);

  return (
    <>
      <header className="dash-head company-profile-head">
        <div>
          <h2>Company Profile</h2>
          <p>Manage customer onboarding and company branding.</p>
        </div>
      </header>

      <section className="company-hub" aria-label="Company Profile workflows">
        <article className="company-hub-card company-hub-card--onboarding">
          <span className="workflow-step">01</span>
          <h3>Customer onboarding</h3>
          <p>Create a company, then issue and share customer invitations from New Request.</p>
          <a className="button-link" href="/workspace/company/onboarding">
            Go to onboarding
          </a>
        </article>
        <article className="company-hub-card company-hub-card--branding">
          <span className="workflow-step workflow-step--teal">02</span>
          <h3>Company branding</h3>
          <p>Manage the logo, stamp, letterhead, and authorised signature used for a company&apos;s own documents.</p>
          <a className="button-link" href="/workspace/company/branding">
            Go to branding
          </a>
        </article>
      </section>
    </>
  );
}
