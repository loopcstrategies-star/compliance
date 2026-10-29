import { apiGet } from '../../../lib/api';
import { requireArea } from '../../../lib/session';
import { CompanyShell } from './company-shell';
import { NetworkHome, type NetworkHomeData } from './network-home';
import { NetworkUnavailable } from './network-unavailable';

export default async function CompanyNetworkHomePage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const home = await apiGet<NetworkHomeData>('/company-network/home');

  return (
    <CompanyShell me={me}>
      {!home?.profile ? <NetworkUnavailable /> : <NetworkHome data={home} />}
    </CompanyShell>
  );
}
