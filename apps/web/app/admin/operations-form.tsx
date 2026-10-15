'use client';

import { FormEvent, useState } from 'react';

export function OperationsForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const tenantId = String(form.get('tenantId'));
    const response = await fetch(`/api/tenants/${tenantId}/operations`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        makerHours: Number(form.get('makerHours')),
        checkerHours: Number(form.get('checkerHours')),
        approverHours: Number(form.get('approverHours')),
        draftReminderDays: Number(form.get('draftReminderDays')),
        expiryLeadDays: Number(form.get('expiryLeadDays')),
        escalationEmail: String(form.get('escalationEmail') ?? ''),
      }),
    });
    if (!response.ok) {
      setError('The operations settings were not saved.');
      return;
    }
    setMessage('Operations settings saved.');
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Review times and reminders</h2>
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
        Maker hours
        <input name="makerHours" type="number" min={1} defaultValue={48} required />
      </label>
      <label>
        Checker hours
        <input name="checkerHours" type="number" min={1} defaultValue={48} required />
      </label>
      <label>
        Authorised approver hours
        <input name="approverHours" type="number" min={1} defaultValue={48} required />
      </label>
      <label>
        Draft reminder days
        <input name="draftReminderDays" type="number" min={1} defaultValue={7} required />
      </label>
      <label>
        Expiry lead days
        <input name="expiryLeadDays" type="number" min={1} defaultValue={30} required />
      </label>
      <label>
        Escalation email
        <input name="escalationEmail" type="email" />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Save operations settings</button>
    </form>
  );
}
