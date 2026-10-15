'use client';

import { FormEvent, useState } from 'react';

export function CloneForm({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    if (form.get('confirm') !== 'yes') {
      setError('Confirm the copy before creating the company.');
      return;
    }
    const response = await fetch(`/api/tenants/${tenantId}/clone`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        confirm: true,
        copyProfile: form.get('copyProfile') === 'on',
        copyApplicability: form.get('copyApplicability') === 'on',
      }),
    });
    if (!response.ok) {
      setError('The company was not copied.');
      return;
    }
    const body = await response.json();
    setMessage(`Created ${body.name}. Applications ${body.applications}, users ${body.users}, files ${body.files}.`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Copy configuration</h2>
      <p className="notice">
        This copies selected profile and template settings from {tenantName} onto a new company. Applications, files, signatures, users, sessions, reviews, and audit rows stay behind.
      </p>
      <label>
        New company name
        <input name="name" required />
      </label>
      <label>
        <input name="copyProfile" type="checkbox" /> Copy profile text
      </label>
      <label>
        <input name="copyApplicability" type="checkbox" /> Copy template applicability
      </label>
      <label>
        <input name="confirm" type="checkbox" value="yes" /> I confirm this copy
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Create company from this configuration</button>
    </form>
  );
}
