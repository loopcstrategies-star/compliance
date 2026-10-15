import { requireArea } from '../../lib/session';
import { Shell } from '../shell';

export default async function WorkspacePage() {
  const me = await requireArea(['employee', 'maker', 'checker', 'authorised_approver', 'super_admin']);
  return (
    <Shell title="Staff workspace" me={me}>
      <p className="notice">Open the area granted to your roles. Each review stage is still a separate action.</p>
    </Shell>
  );
}
