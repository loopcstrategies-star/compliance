'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft } from './draft-form';

const OPEN = new Set(['draft', 'correction']);

export function SubmitCase({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const status = draft.application.status;

  async function submit() {
    setMessage('');
    setError('');
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
    setMessage('Submitted for review.');
    router.refresh();
  }

  return (
    <section>
      <h2>Review</h2>
      <p className="notice">Status: {status.replaceAll('_', ' ')}</p>
      {OPEN.has(status) ? (
        <button type="button" onClick={submit}>
          Submit for review
        </button>
      ) : null}
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
    </section>
  );
}
