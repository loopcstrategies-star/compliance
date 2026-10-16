'use client';

import { FormEvent, useState } from 'react';

type Answer = { fieldKey: string; value: unknown };
type Evidence = { id: string; documentType: string; expiresOn: string | null };
type Grant = { id: string; recipientName: string; expiresAt: string; revokedAt: string | null };

const ROW_KEYS = new Set([
  'kyc.shareholder_entity.rows',
  'kyc.ubo.rows',
  'kyc.shareholder_individual.rows',
  'kyc.management.rows',
]);

const PROFILE_FIELDS = [
  { key: 'kyc.entity.name', label: 'Registered name' },
  { key: 'kyc.entity.registered_office_address', label: 'Registered office' },
  { key: 'kyc.entity.city', label: 'City' },
  { key: 'kyc.entity.country', label: 'Country' },
  { key: 'kyc.entity.registered_email', label: 'Registered email' },
  { key: 'kyc.entity.telephone_fax', label: 'Telephone' },
  { key: 'kyc.entity.registration_no', label: 'Registration number' },
  { key: 'kyc.shareholder_entity.rows', label: 'Entity shareholders at or above 5%' },
  { key: 'kyc.ubo.rows', label: 'Ultimate beneficial owners' },
  { key: 'kyc.shareholder_individual.rows', label: 'Individual shareholders at or above 5%' },
  { key: 'kyc.management.rows', label: 'Management' },
  { key: 'kyc.pep.a', label: 'PEP question a' },
  { key: 'kyc.pep.b', label: 'PEP question b' },
  { key: 'kyc.bank.name', label: 'Bank name' },
  { key: 'kyc.bank.iban', label: 'IBAN' },
  { key: 'kyc.bank.swift', label: 'SWIFT' },
  { key: 'kyc.docs.1', label: 'Trade, mining, or commercial licence' },
  { key: 'kyc.docs.2', label: 'Certificate of incorporation' },
  { key: 'kyc.docs.3', label: 'Registry extract' },
  { key: 'kyc.docs.4', label: 'Shareholder certificate' },
  { key: 'kyc.docs.5', label: 'Memorandum of association' },
  { key: 'kyc.docs.6', label: 'Articles of association' },
  { key: 'kyc.docs.7', label: 'Proof of address' },
  { key: 'kyc.docs.8', label: 'Shareholder identity' },
  { key: 'kyc.docs.9', label: 'UBO identity' },
  { key: 'kyc.docs.10', label: 'Director and management identity' },
  { key: 'kyc.docs.11', label: 'Authorised representative identity' },
  { key: 'kyc.docs.12', label: 'VAT certificate' },
  { key: 'kyc.docs.13', label: 'AML policies' },
];

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
    const answers = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, storedValue(field.key, form.get(field.key))]));
    const response = await fetch(`/api/tenants/${tenantId}/company-kyc`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, answers }),
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
    const purpose = String(form.get('purpose') ?? '').trim();
    if (!purpose) {
      setError('A purpose is required.');
      return;
    }
    const fieldKeys = PROFILE_FIELDS.map((field) => field.key).filter((key) => form.get(key) === 'on');
    const evidenceIds = profile.evidence.map((item) => item.id).filter((id) => form.get(`evidence:${id}`) === 'on');
    const response = await fetch(`/api/tenants/${tenantId}/company-kyc/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        confirm: true,
        recipientName: form.get('recipientName'),
        recipientContact: form.get('recipientContact'),
        purpose,
        fieldKeys,
        evidenceIds,
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
        {PROFILE_FIELDS.map((field) => (
          <label key={field.key}>
            {field.label}
            <input name={field.key} defaultValue={shownValue(field.key, saved[field.key])} />
          </label>
        ))}
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
          Purpose
          <input name="purpose" required />
        </label>
        {PROFILE_FIELDS.map((field) => (
          <label key={field.key}>
            <input name={field.key} type="checkbox" /> {field.label}
          </label>
        ))}
        {profile.evidence.map((item) => (
          <label key={item.id}>
            <input name={`evidence:${item.id}`} type="checkbox" /> {item.documentType}
          </label>
        ))}
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

function storedValue(key: string, raw: FormDataEntryValue | null): unknown {
  const value = String(raw ?? '').trim();
  if (ROW_KEYS.has(key)) {
    return value ? [{ name: value }] : [];
  }
  return value;
}

function shownValue(key: string, value: unknown): string {
  if (ROW_KEYS.has(key) && Array.isArray(value)) {
    const first = value[0];
    if (first && typeof first === 'object' && 'name' in first && typeof first.name === 'string') {
      return first.name;
    }
    return '';
  }
  return typeof value === 'string' ? value : '';
}
