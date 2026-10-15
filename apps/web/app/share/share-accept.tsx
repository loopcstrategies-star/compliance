'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ShareAccept({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function openPack() {
    setError('');
    const response = await fetch('/api/company-kyc/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) {
      setError('This share link cannot be used.');
      return;
    }
    window.history.replaceState(null, '', '/share');
    router.replace('/share/pack');
  }

  return (
    <div>
      {error ? <p className="notice error">{error}</p> : null}
      <button type="button" onClick={openPack}>
        Open shared pack
      </button>
    </div>
  );
}
