import { redirect } from 'next/navigation';
import { requireArea } from '../../lib/session';

export default async function EmployeePage() {
  await requireArea(['employee']);
  redirect('/workspace/requests');
}
