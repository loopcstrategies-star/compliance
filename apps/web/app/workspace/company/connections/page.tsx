import { apiGet } from '../../../../lib/api';
import { requireArea } from '../../../../lib/session';
import { CompanyShell } from '../company-shell';
import { ConnectionsClient } from '../connections-client';
import type { ConnectionRow } from '../network-types';

export default async function ConnectionsPage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const [connected, received, sent] = await Promise.all([
    apiGet<ConnectionRow[]>('/company-network/connections'),
    apiGet<ConnectionRow[]>('/company-network/requests/received'),
    apiGet<ConnectionRow[]>('/company-network/requests/sent'),
  ]);

  return (
    <CompanyShell me={me}>
      <ConnectionsClient connected={connected ?? []} received={received ?? []} sent={sent ?? []} />
    </CompanyShell>
  );
}
