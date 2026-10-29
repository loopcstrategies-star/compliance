import { redirect } from 'next/navigation';
import { requireArea } from '../../../lib/session';

export default async function CompanyPage() {
  await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  redirect('/workspace/company/my');
}
