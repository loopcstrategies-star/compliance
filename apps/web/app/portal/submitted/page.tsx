import Link from 'next/link';
import { requireArea } from '../../../lib/session';
import { apiGet } from '../../../lib/api';
import { Shell } from '../../shell';
import type { Draft } from '../wizard/types';

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  maker_review: 'In review',
  checker_review: 'In review',
  reassessment: 'In review',
  approved: 'Approved',
  correction: 'Correction required',
  draft: 'Draft',
};

export default async function PortalSubmittedPage() {
  const me = await requireArea(['customer']);
  const draft = await apiGet<Draft>('/applications/current');
  if (!draft) {
    return (
      <Shell title="Customer portal" me={me}>
        <p className="notice">No application was found for this account.</p>
      </Shell>
    );
  }

  const status = draft.application.status;
  const label = STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
  const submittedAt = draft.submittedAt ? new Date(draft.submittedAt).toLocaleString() : null;

  return (
    <Shell title="Customer portal" me={me}>
      <section className="panel portal-status-panel">
        <h1>Submitted for review</h1>
        <p className="notice">Your application was received. You do not need to submit again unless a correction is requested.</p>
        <dl className="portal-status-dl">
          <div>
            <dt>Application ID</dt>
            <dd>
              <code title={draft.application.id}>{draft.application.id}</code>
            </dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={`chip ${status}`}>{label}</span>
            </dd>
          </div>
          {submittedAt ? (
            <div>
              <dt>Submitted</dt>
              <dd>{submittedAt}</dd>
            </div>
          ) : (
            <div>
              <dt>Submitted</dt>
              <dd className="notice">Submission timestamp unavailable — contact support if this persists.</dd>
            </div>
          )}
        </dl>
        <p>
          <Link className="button-link button-link--outline" href="/portal">
            View application status
          </Link>
        </p>
      </section>
    </Shell>
  );
}
