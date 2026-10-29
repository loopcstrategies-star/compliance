import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { ProfileEditor } from '../profile-editor';
import type { NetworkProfile } from '../network-types';

export default async function MyCompanyPage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const profile = await apiGet<NetworkProfile>('/company-network/me');

  return (
    <CompanyShell me={me}>
      {!profile ? (
        <p className="notice error">
          Company networking is not available for this account. Platform system tenants manage onboarding and branding
          only; use an onboarding company account for LoopC networking.
        </p>
      ) : (
        <section className="panel network-profile">
          <div
            className="network-cover"
            style={{
              backgroundImage: profile.hasCover
                ? `url(/api/company-network/companies/${profile.tenantId}/cover)`
                : undefined,
            }}
          />
          <div className="network-profile-head">
            {profile.hasLogo ? (
              <img
                className="network-logo"
                src={`/api/company-network/companies/${profile.tenantId}/logo`}
                alt={`${profile.companyName} logo`}
              />
            ) : (
              <div className="network-logo network-logo--placeholder" aria-hidden="true">
                {(profile.companyName || 'C').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <h3>{profile.companyName}</h3>
              <p>{profile.headline || 'Add a headline to introduce your company.'}</p>
              <p className="muted-line">
                {[profile.industry, profile.city, profile.country].filter(Boolean).join(' · ') || 'Location not set'}
              </p>
              <p className="muted-line">
                Visibility: {profile.visibility}
                {profile.discoverable ? ' · Discoverable' : ' · Hidden from discovery'}
                {typeof profile.connectionCount === 'number' ? ` · ${profile.connectionCount} connections` : ''}
              </p>
              {profile.completion ? (
                <p className="completion-meter" aria-label={`Profile ${profile.completion.percent}% complete`}>
                  Profile completion {profile.completion.percent}%
                  <span>
                    <i style={{ width: `${profile.completion.percent}%` }} />
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          <ProfileEditor profile={profile} />
          <div className="network-profile-body">
            <h4>About</h4>
            <p>{profile.introduction || 'No introduction yet.'}</p>
            <h4>Products and services</h4>
            <p>{profile.productsServices || 'Not provided.'}</p>
            <h4>Capabilities</h4>
            <p>{profile.capabilities || 'Not provided.'}</p>
            <h4>Public contact</h4>
            <p>
              {[profile.website, profile.publicEmail, profile.publicPhone].filter(Boolean).join(' · ') ||
                'No public contact details.'}
            </p>
            {(profile.companySize || profile.yearEstablished) && (
              <p className="muted-line">
                {[profile.companySize ? `Size ${profile.companySize}` : '', profile.yearEstablished ? `Est. ${profile.yearEstablished}` : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
        </section>
      )}
    </CompanyShell>
  );
}
