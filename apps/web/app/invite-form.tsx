'use client';

import { FormEvent, useState } from 'react';

const TYPES = [
  { value: 'local_company', label: 'Local company' },
  { value: 'foreign_company', label: 'Foreign company' },
  { value: 'mine', label: 'Mine' },
  { value: 'individual', label: 'Individual' },
];

export function InviteForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        legalName: form.get('legalName'),
        customerType: form.get('customerType'),
      }),
    });
    if (!response.ok) {
      setError('The invitation was not created.');
      return;
    }
    const body = await response.json();
    setMessage(`Invitation issued. Accept path: ${body.acceptPath}`);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Invite a customer</h2>
      <label>
        Email
        <input name="email" type="email" required />
      </label>
      <label>
        Legal name
        <input name="legalName" required />
      </label>
      <label>
        Customer type
        <select name="customerType" defaultValue="local_company">
          {TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Issue invitation</button>
    </form>
  );
}
