'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        password: form.get('password'),
        displayName: form.get('displayName'),
      }),
    });
    if (!response.ok) {
      setError('This invitation cannot be used.');
      return;
    }
    router.push('/portal');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Your name
        <input name="displayName" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="new-password" minLength={10} required />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      <button type="submit">Create account</button>
    </form>
  );
}
