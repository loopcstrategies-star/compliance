'use client';

import { FormEvent, useState } from 'react';

type Policy = {
  makerDistinctFromChecker: boolean;
  checkerDistinctFromApprover: boolean;
  makerDistinctFromApprover: boolean;
};

export function SegregationForm({ tenants }: { tenants: { id: string; name: string }[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const tenantId = String(form.get('tenantId'));
    const response = await fetch(`/api/tenants/${tenantId}/segregation`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        makerDistinctFromChecker: form.get('makerDistinctFromChecker') === 'on',
        checkerDistinctFromApprover: form.get('checkerDistinctFromApprover') === 'on',
        makerDistinctFromApprover: form.get('makerDistinctFromApprover') === 'on',
      }),
    });
    if (!response.ok) {
      setError('The segregation policy was not saved.');
      return;
    }
    const body = (await response.json()) as Policy;
    setMessage(
      `Saved. Maker and checker differ: ${body.makerDistinctFromChecker}. Checker and approver differ: ${body.checkerDistinctFromApprover}. Maker and approver differ: ${body.makerDistinctFromApprover}.`,
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Segregation of duties</h2>
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
        <input name="makerDistinctFromChecker" type="checkbox" defaultChecked />
        Maker and checker are different people
      </label>
      <label>
        <input name="checkerDistinctFromApprover" type="checkbox" defaultChecked />
        Checker and authorised approver are different people
      </label>
      <label>
        <input name="makerDistinctFromApprover" type="checkbox" defaultChecked />
        Maker and authorised approver are different people
      </label>
      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
      <button type="submit">Save segregation policy</button>
    </form>
  );
}
