'use client';

import { FormEvent, useState } from 'react';

export function ResumeForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/invitations/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.get('email') }),
    });
    if (!response.ok) {
      setError(response.status === 429 ? 'Wait a minute before issuing another link.' : 'A new link was not issued.');
      return;
    }
    const body = await response.json();
    setMessage(`A new accept path is ready: ${body.acceptPath}`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Resume an applicant</h2>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Issue a new link</button>
    </form>
  );
}
