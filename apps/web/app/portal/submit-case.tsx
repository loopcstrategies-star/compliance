'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Draft } from './draft-form';

const OPEN = new Set(['draft', 'correction', 'reassessment']);

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
      setError('The case was not submitted.');
      return;
    }
    setMessage('Submitted for maker review.');
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
