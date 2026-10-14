import { requireArea } from '../../lib/session';
import { apiGet } from '../../lib/api';
import { Shell } from '../shell';
import { DraftForm, type Draft } from './draft-form';
import { DocumentsPanel } from './documents-panel';
import { SubmitCase } from './submit-case';

export default async function PortalPage() {
  const me = await requireArea(['customer']);
  const draft = await apiGet<Draft>('/applications/current');
  return (
    <Shell title="Customer portal" me={me}>
      {draft ? (
        <>
          <ol className="stepper">
            <li>Company details</li>
            <li>Documents</li>
            <li>Submit</li>
          </ol>
          <p className="notice">
            {draft.application.customerType.replaceAll('_', ' ')} · {draft.application.status.replaceAll('_', ' ')} · version {draft.application.documentVersion}
          </p>
          <DraftForm draft={draft} />
          <DocumentsPanel draft={draft} />
          <SubmitCase draft={draft} />
        </>
      ) : (
        <p className="notice">No onboarding draft is available for this account.</p>
      )}
    </Shell>
  );
}
