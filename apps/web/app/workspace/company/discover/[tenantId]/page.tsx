import Link from 'next/link';
import { apiGet } from '../../../../../lib/api';
import { requireArea } from '../../../../../lib/session';
import { CompanyShell } from '../../company-shell';
import { NetworkUnavailable } from '../../network-unavailable';
import { PeerCompanyProfile } from '../../peer-company-profile';
import type { NetworkProfile } from '../../network-types';

export default async function PeerCompanyPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const { tenantId } = await params;
  const profile = await apiGet<NetworkProfile>(`/company-network/companies/${tenantId}`);
  const isOwn = profile?.tenantId === me.tenantId;

  return (
    <CompanyShell me={me}>
      <p className="company-breadcrumb">
        <Link href="/workspace/company/discover">Discover Companies</Link> / Profile
      </p>
      {!profile ? (
        me.roles.includes('super_admin') ? (
          <NetworkUnavailable title="This company profile is not available" />
        ) : (
          <p className="notice error">This company profile is not available.</p>
        )
      ) : (
        <PeerCompanyProfile profile={profile} isOwn={Boolean(isOwn)} />
      )}
    </CompanyShell>
  );
}
