'use client';

import { useState } from 'react';
import { openInvitation } from './open-invitation';
import { planAcceptHandoff } from './accept-handoff';

export function AcceptForm({ token }: { token: string }) {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function openAccount() {
    if (pending || done) {
      return;
    }
    setPending(true);
    setError('');
    const result = await openInvitation(token);
    const handoff = planAcceptHandoff(result);
    if (handoff.kind === 'error') {
      setError(handoff.error);
      setPending(false);
      return;
    }
    setDone(true);
    window.history.replaceState(null, '', '/accept');
    window.location.replace(handoff.href);
  }

  return (
    <div>
      {error ? <p className="notice error">{error}</p> : null}
      <button type="button" onClick={() => void openAccount()} disabled={pending || done}>
        {pending || done ? 'Opening' : 'Open application'}
      </button>
    </div>
  );
}
