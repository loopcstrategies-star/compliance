import { redirect } from 'next/navigation';
import { requireArea } from '../../lib/session';

export default async function CompliancePage() {
  const me = await requireArea(['maker', 'checker', 'authorised_approver']);
  redirect(me.roles.includes('maker') ? '/workspace/requests' : '/workspace/waiting');
}
