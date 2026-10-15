'use client';

import { FormEvent, useState } from 'react';

type Answer = { fieldKey: string; value: unknown };
type Evidence = { id: string; documentType: string; expiresOn: string | null };
type Grant = { id: string; recipientName: string; expiresAt: string; revokedAt: string | null };

export function CompanyKycPanel({
  tenantId,
  profile,
}: {
  tenantId: string;
  profile: { status: string; reviewedAt: string | null; updatedAt: string | null; answers: Answer[]; evidence: Evidence[]; grants: Grant[] };
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const saved = Object.fromEntries(profile.answers.map((answer) => [answer.fieldKey, answer.value]));

  async function save(event: FormEvent<HTMLFormElement>, status: 'draft' | 'ready') {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/tenants/${tenantId}/company-kyc`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        status,
        answers: {
          'kyc.entity.name': form.get('legalName'),
          'kyc.entity.country': form.get('country'),
          'kyc.entity.registered_email': form.get('email'),
          'kyc.entity.telephone_fax': form.get('phone'),
        },
      }),
    });
    if (!response.ok) {
      setError('The company KYC profile was not saved.');
      return;
    }
    setMessage(status === 'ready' ? 'Profile marked ready for review.' : 'Draft saved.');
  }

  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    if (form.get('confirm') !== 'yes') {
      setError('Confirm the selected fields before sharing.');
      return;
    }
    const fieldKeys = ['kyc.entity.name', 'kyc.entity.country', 'kyc.entity.registered_email', 'kyc.entity.telephone_fax'].filter(
      (key) => form.get(key) === 'on',
    );
    const response = await fetch(`/api/tenants/${tenantId}/company-kyc/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirm: true,
        recipientName: form.get('recipientName'),
        recipientContact: form.get('recipientContact'),
        fieldKeys,
        evidenceIds: [],
      }),
    });
    if (!response.ok) {
      setError('The pack was not shared.');
      return;
    }
    const body = await response.json();
    setMessage(`Share path ready. Email was not sent. ${body.acceptPath}`);
  }

  return (
    <section id="company-kyc" className="panel">
      <h2>Reusable Company KYC Profile</h2>
      <p className="notice">
        This is the onboarding company’s own KYC record. It is not an applicant case and does not appear in New Request, Waiting List, or Customer List.
        Status {profile.status}. {profile.updatedAt ? `Saved ${new Date(profile.updatedAt).toLocaleString()}.` : 'Nothing is saved yet.'}{' '}
        {profile.reviewedAt ? `Marked ready ${new Date(profile.reviewedAt).toLocaleString()}.` : ''}
      </p>
      <form
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          return save(event, submitter?.value === 'ready' ? 'ready' : 'draft');
        }}
      >
        <label>
          Registered name
          <input name="legalName" defaultValue={text(saved['kyc.entity.name'])} />
        </label>
        <label>
          Country
          <input name="country" defaultValue={text(saved['kyc.entity.country'])} />
        </label>
        <label>
          Registered email
          <input name="email" defaultValue={text(saved['kyc.entity.registered_email'])} />
        </label>
        <label>
          Telephone
          <input name="phone" defaultValue={text(saved['kyc.entity.telephone_fax'])} />
        </label>
        <div className="actions">
          <button type="submit" value="draft">
            Save draft
          </button>
          <button type="submit" value="ready">
            Save and mark ready for review
          </button>
        </div>
      </form>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage('');
          setError('');
          const form = new FormData(event.currentTarget);
          const response = await fetch(`/api/tenants/${tenantId}/company-kyc/evidence`, { method: 'POST', body: form });
          if (!response.ok) {
            setError('The evidence was not stored.');
            return;
          }
          setMessage('Evidence stored.');
          event.currentTarget.reset();
        }}
      >
        <h3>Company evidence</h3>
        <label>
          Document type
          <input name="documentType" required />
        </label>
        <label>
          Expiry
          <input name="expiresOn" type="date" />
        </label>
        <label>
          File
          <input name="file" type="file" required />
        </label>
        <button type="submit">Upload evidence</button>
      </form>
      {profile.evidence.length === 0 ? <p className="notice">No company evidence is stored.</p> : null}
      <ul>
        {profile.evidence.map((item) => (
          <li key={item.id}>
            {item.documentType}
            {item.expiresOn ? ` · expires ${new Date(item.expiresOn).toLocaleDateString()}` : ''}
          </li>
        ))}
      </ul>
      <form onSubmit={share}>
        <h3>Share a selected pack</h3>
        <label>
          Recipient name
          <input name="recipientName" required />
        </label>
        <label>
          Recipient contact
          <input name="recipientContact" type="email" required />
        </label>
        <label>
          <input name="kyc.entity.name" type="checkbox" /> Registered name
        </label>
        <label>
          <input name="kyc.entity.country" type="checkbox" /> Country
        </label>
        <label>
          <input name="kyc.entity.registered_email" type="checkbox" /> Registered email
        </label>
        <label>
          <input name="kyc.entity.telephone_fax" type="checkbox" /> Telephone
        </label>
        <label>
          <input name="confirm" type="checkbox" value="yes" /> I confirm this selection
        </label>
        <button type="submit">Create share link</button>
      </form>
      <ul>
        {profile.grants.map((grant) => (
          <li key={grant.id}>
            {grant.recipientName} · {grant.revokedAt ? 'revoked' : `until ${new Date(grant.expiresAt).toLocaleDateString()}`}
          </li>
        ))}
      </ul>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
    </section>
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
