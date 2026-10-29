import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { MyCompanyProfile } from '../my-company-profile';
import { NetworkUnavailable } from '../network-unavailable';
import type { NetworkProfile } from '../network-types';

export default async function MyCompanyPage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const profile = await apiGet<NetworkProfile>('/company-network/me');

  return (
    <CompanyShell me={me}>
      {!profile ? <NetworkUnavailable /> : <MyCompanyProfile profile={profile} />}
    </CompanyShell>
  );
}
