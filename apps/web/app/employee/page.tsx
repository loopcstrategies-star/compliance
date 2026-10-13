import { requireArea } from '../../lib/session';
import { apiGet } from '../../lib/api';
import { Shell } from '../shell';
import { InviteForm } from '../invite-form';
import { AssignForm } from './assign-form';

type Dashboard = {
  draft: number;
  submitted: number;
  makerReview: number;
  checkerReview: number;
  approved: number;
  correction: number;
  reassessment: number;
  overdue: number;
  expiringDocuments: number;
  cases: { id: string; status: string; legalName: string; assigneeId: string | null }[];
};

const LABELS: [keyof Omit<Dashboard, 'cases'>, string][] = [
  ['draft', 'Draft'],
  ['submitted', 'Submitted'],
  ['makerReview', 'Maker review'],
  ['checkerReview', 'Checker review'],
  ['approved', 'Approved'],
  ['correction', 'Correction'],
  ['reassessment', 'Reassessment'],
  ['overdue', 'Overdue reviews'],
  ['expiringDocuments', 'Documents nearing expiry'],
];

export default async function EmployeePage() {
  const me = await requireArea(['employee']);
  const dashboard = await apiGet<Dashboard>('/dashboard');
  const users = (await apiGet<{ id: string; displayName: string; email: string }[]>('/users')) ?? [];
  return (
    <Shell title="Employee dashboard" me={me}>
      <InviteForm />
      <section>
        <h2>Counts</h2>
        <ul>
          {LABELS.map(([key, label]) => (
            <li key={key}>
              {label}: {dashboard?.[key] ?? 0}
            </li>
          ))}
        </ul>
      </section>
      <AssignForm cases={dashboard?.cases ?? []} users={users} />
    </Shell>
  );
}
