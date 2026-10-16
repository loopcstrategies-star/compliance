'use client';

import { FormEvent, useState } from 'react';
import { staffFailure } from '../../lib/staff-error';

export function ResumeForm({ companies = [] }: { companies?: { id: string; name: string }[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const tenantId = String(form.get('tenantId') ?? '');
    const response = await fetch('/api/invitations/resume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), ...(tenantId ? { tenantId } : {}) }),
    });
    if (!response.ok) {
      setError(await staffFailure(response, 'The invitation was not created.'));
      return;
    }
    const body = (await response.json()) as { acceptPath: string; expiresAt: string };
    const url = new URL(body.acceptPath, window.location.origin).toString();
    setMessage(`Email was not sent. Share this link manually. It expires ${new Date(body.expiresAt).toLocaleString()}. ${url}`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Resume an applicant</h2>
      {companies.length > 0 ? (
        <label>
          Onboarding company
          <select name="tenantId" required defaultValue="">
            <option value="" disabled>
              Select a company
            </option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
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
