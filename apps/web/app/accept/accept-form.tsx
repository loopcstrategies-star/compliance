'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { openInvitation } from './open-invitation';

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function openAccount() {
    setPending(true);
    setError('');
    try {
      const result = await openInvitation(token);
      if (!result.redirect) {
        setError(result.error);
        return;
      }
      window.history.replaceState(null, '', '/accept');
      router.replace('/portal');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {error ? <p className="notice error">{error}</p> : null}
      <button type="button" onClick={openAccount} disabled={pending}>
        {pending ? 'Opening' : 'Open application'}
      </button>
    </div>
  );
}
