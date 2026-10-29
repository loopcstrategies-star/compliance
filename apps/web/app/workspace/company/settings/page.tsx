import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { MemberProfileEditor } from '../member-profile-editor';
import { SettingsClient } from '../settings-client';
import type { NetworkProfile } from '../network-types';

export default async function CompanyNetworkSettingsPage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const profile = await apiGet<NetworkProfile>('/company-network/me');

  return (
    <CompanyShell me={me}>
      {!profile ? (
        <p className="notice error">Company networking settings are not available for this account.</p>
      ) : (
        <>
          <SettingsClient profile={profile} />
          <MemberProfileEditor showPrefs />
        </>
      )}
    </CompanyShell>
  );
}
