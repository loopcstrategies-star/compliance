import { redirect } from 'next/navigation';
import { tabsForRoles } from '../../lib/home';
import { requireArea } from '../../lib/session';

export default async function WorkspacePage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  const first = tabsForRoles(me.roles).find((tab) => tab.group === 'main');
  redirect(first?.href ?? '/login');
}
