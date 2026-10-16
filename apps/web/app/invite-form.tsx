'use client';

import { FormEvent, useState } from 'react';
import { staffFailure } from '../lib/staff-error';

const TYPES = [
  { value: 'local_company', label: 'Local company' },
  { value: 'foreign_company', label: 'Foreign company' },
  { value: 'mine', label: 'Mine' },
  { value: 'individual', label: 'Individual' },
];

type Company = { id: string; name: string };
type Issued = { url: string; expiresAt: string };

export function InviteForm({ companies = [] }: { companies?: Company[] }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIssued(null);
    setCopied(false);
    setError('');
    const form = new FormData(event.currentTarget);
    const tenantId = String(form.get('tenantId') ?? '');
    const response = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        legalName: form.get('legalName'),
        customerType: form.get('customerType'),
        ...(tenantId ? { tenantId } : {}),
      }),
    });
    if (!response.ok) {
      setError(await staffFailure(response, 'The invitation was not created.'));
      return;
    }
    const body = (await response.json()) as { acceptPath: string; expiresAt: string; emailSent: boolean };
    setIssued({ url: new URL(body.acceptPath, window.location.origin).toString(), expiresAt: body.expiresAt });
    event.currentTarget.reset();
  }

  async function copy() {
    if (!issued) {
      return;
    }
    await navigator.clipboard.writeText(issued.url);
    setCopied(true);
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Invite a customer</h2>
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
      <p className="notice">The link expires 7 days after it is issued. Email is not sent. Share the link manually.</p>
      {error ? <p className="notice error">{error}</p> : null}
      {issued ? (
        <div className="notice success">
          <p>Email was not sent. Share this link manually. It expires {new Date(issued.expiresAt).toLocaleString()}.</p>
          <p>
            <a href={issued.url}>{issued.url}</a>
          </p>
          <button type="button" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
      <button type="submit">Issue invitation</button>
    </form>
  );
}
