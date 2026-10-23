import Link from 'next/link';
import type { Draft } from './wizard/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  maker_review: 'In review',
  checker_review: 'In review',
  correction: 'Correction required',
  reassessment: 'In review',
  approved: 'Approved',
};

export function ApplicationStatusPanel({ draft }: { draft: Draft }) {
  const status = draft.application.status;
  const label = STATUS_LABELS[status] ?? status.replaceAll('_', ' ');
  const submittedAt = draft.submittedAt ? new Date(draft.submittedAt).toLocaleString() : null;

  return (
    <section className="panel portal-status-panel">
      <h1>Application status</h1>
      <p className="notice">This application is no longer editable in the customer portal.</p>
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
        <div>
          <dt>Type</dt>
          <dd>{draft.application.customerType.replaceAll('_', ' ')}</dd>
        </div>
        {submittedAt ? (
          <div>
            <dt>Submitted</dt>
            <dd>{submittedAt}</dd>
          </div>
        ) : null}
        <div>
          <dt>Document version</dt>
          <dd>{draft.application.documentVersion}</dd>
        </div>
      </dl>
      {status === 'correction' ? (
        <p className="notice">
          A correction was requested. Open the portal again after the review team unlocks editing, or continue from your invitation
          link if provided.
        </p>
      ) : null}
      <p className="notice">
        <Link href="/portal">Refresh status</Link>
      </p>
    </section>
  );
}
