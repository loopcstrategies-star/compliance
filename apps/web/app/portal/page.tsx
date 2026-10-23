import { requireArea } from '../../lib/session';
import { apiGet } from '../../lib/api';
import { Shell } from '../shell';
import { OnboardingWizard } from './wizard/onboarding-wizard';
import type { Draft } from './wizard/types';

export default async function PortalPage() {
  const me = await requireArea(['customer']);
  const draft = await apiGet<Draft>('/applications/current');
  return (
    <Shell title="Customer portal" me={me}>
      {draft ? (
        <OnboardingWizard draft={draft} />
      ) : (
        <p className="notice">No onboarding draft is available for this account.</p>
      )}
    </Shell>
  );
}
