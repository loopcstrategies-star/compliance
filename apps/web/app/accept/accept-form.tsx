'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function openAccount() {
    setPending(true);
    setError('');
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setPending(false);
      setError('This invitation cannot be used.');
      return;
    }
    window.history.replaceState(null, '', '/accept');
    router.replace('/portal');
    router.refresh();
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
