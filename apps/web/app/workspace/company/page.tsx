import { apiGet } from '../../../lib/api';
import { requireArea } from '../../../lib/session';
import { CompanyShell } from './company-shell';
import { NetworkHome, type NetworkHomeData } from './network-home';

export default async function CompanyNetworkHomePage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const home = await apiGet<NetworkHomeData>('/company-network/home');

  return (
    <CompanyShell me={me}>
      {!home?.profile ? (
        <p className="notice error">
          Company networking is not available for this account. Platform system tenants manage onboarding and branding
          only; use an onboarding company account for LoopC networking.
        </p>
      ) : (
        <NetworkHome data={home} />
      )}
    </CompanyShell>
  );
}
