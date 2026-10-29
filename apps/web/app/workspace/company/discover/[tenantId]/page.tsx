import Link from 'next/link';
import { apiGet } from '../../../../../lib/api';
import { requireArea } from '../../../../../lib/session';
import { CompanyShell } from '../../company-shell';
import { ConnectionActions } from '../../connection-actions';
import type { NetworkProfile } from '../../network-types';

export default async function PeerCompanyPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const { tenantId } = await params;
  const profile = await apiGet<NetworkProfile>(`/company-network/companies/${tenantId}`);

  return (
    <CompanyShell me={me}>
      <p className="company-breadcrumb">
        <Link href="/workspace/company/discover">Discover Companies</Link> / Profile
      </p>
      {!profile ? (
        <p className="notice error">This company profile is not available.</p>
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
              <p>{profile.headline || 'No headline'}</p>
              <p className="muted-line">
                {[profile.industry, profile.city, profile.country].filter(Boolean).join(' · ')}
              </p>
              <ConnectionActions
                tenantId={profile.tenantId}
                connectionId={profile.connectionId}
                status={profile.connectionStatus}
                canMessage={profile.canMessage}
              />
            </div>
          </div>
          <div className="network-profile-body">
            <h4>About</h4>
            <p>{profile.introduction || 'No introduction published.'}</p>
            <h4>Products and services</h4>
            <p>{profile.productsServices || 'Not published.'}</p>
            <h4>Capabilities</h4>
            <p>{profile.capabilities || 'Not published.'}</p>
            <h4>Public contact</h4>
            <p>
              {[profile.website, profile.publicEmail, profile.publicPhone].filter(Boolean).join(' · ') ||
                'No public contact details.'}
            </p>
          </div>
        </section>
      )}
    </CompanyShell>
  );
}
