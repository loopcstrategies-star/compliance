import type { ReactNode } from 'react';
import { requireArea } from '../../lib/session';
import { Shell } from '../shell';

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  return (
    <Shell title="Onboarding" me={me}>
      {children}
    </Shell>
  );
}
