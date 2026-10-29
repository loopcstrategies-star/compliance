import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { DiscoverClient } from '../discover-client';

export default async function DiscoverPage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  return (
    <CompanyShell me={me}>
      <DiscoverClient />
    </CompanyShell>
  );
}
