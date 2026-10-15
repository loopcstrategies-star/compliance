'use client';

import { FormEvent, useState } from 'react';

export function CategoryForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/checklist-categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: form.get('tenantId'),
        label: form.get('label'),
      }),
    });
    if (!response.ok) {
      setError('The category was not added.');
      return;
    }
    const body = await response.json();
    setMessage(`Added “${body.label}” for this tenant.`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Extra checklist category</h2>
      <label>
        Tenant
        <select name="tenantId" required defaultValue={tenants[0]?.id ?? ''}>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Label
        <input name="label" required />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Add category</button>
    </form>
  );
}
