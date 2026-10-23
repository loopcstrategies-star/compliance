'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft } from './draft-form';

const OPEN = new Set(['draft', 'correction']);

export function SubmitCase({
  draft,
  incompleteSections = [],
}: {
  draft: Draft;
  incompleteSections?: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const status = draft.application.status;
  const blocked = incompleteSections.length > 0;

  async function submit() {
    if (submitting || blocked) {
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch(`/api/applications/${draft.application.id}/submit`, { method: 'POST' });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
          missingAnswers?: string[];
          missingUploads?: string[];
          blockedPlacements?: string[];
        } | null;
        const parts = [
          body?.missingAnswers?.length ? `Missing answers: ${body.missingAnswers.join(', ')}` : '',
          body?.missingUploads?.length ? `Missing uploads: ${body.missingUploads.join(', ')}` : '',
          body?.blockedPlacements?.length ? `PDF placements blocked: ${body.blockedPlacements.join(', ')}` : '',
        ].filter(Boolean);
        setError(parts.join(' ') || body?.message || 'The case was not submitted.');
        return;
      }
      router.push('/portal/submitted');
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="wizard-submit-block">
      <h3>Submit for review</h3>
      <p className="notice">Status: {status.replaceAll('_', ' ')}</p>
      {blocked ? (
        <p className="notice error" role="alert">
          Complete these sections before submitting: {incompleteSections.join(', ')}.
        </p>
      ) : null}
      {OPEN.has(status) ? (
        <button type="button" onClick={() => void submit()} disabled={submitting || blocked}>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </button>
      ) : null}
      {error ? <p className="notice error">{error}</p> : null}
    </section>
  );
}
