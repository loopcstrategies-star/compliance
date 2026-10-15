'use client';

import { FormEvent, useState } from 'react';

export type CompanyProfile = {
  id: string;
  name: string;
  displayName: string;
  registrationId: string;
  registeredAddress: string;
  operatingAddress: string;
  country: string;
  phone: string;
  website: string;
  complianceEmail: string;
};

export function ProfileForm({ profile }: { profile: CompanyProfile }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/tenants/${profile.id}/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: form.get('displayName'),
        registrationId: form.get('registrationId'),
        registeredAddress: form.get('registeredAddress'),
        operatingAddress: form.get('operatingAddress'),
        country: form.get('country'),
        phone: form.get('phone'),
        website: form.get('website'),
        complianceEmail: form.get('complianceEmail'),
      }),
    });
    if (!response.ok) {
      setError('The company profile was not saved.');
      return;
    }
    setMessage('Company profile saved.');
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Company profile</h2>
      <p className="notice">Record for {profile.name}. Logo and letterhead stay in the letterhead section.</p>
      <label>
        Display name
        <input name="displayName" defaultValue={profile.displayName} />
      </label>
      <label>
        Registration id
        <input name="registrationId" defaultValue={profile.registrationId} />
      </label>
      <label>
        Registered address
        <textarea name="registeredAddress" defaultValue={profile.registeredAddress} />
      </label>
      <label>
        Operating address
        <textarea name="operatingAddress" defaultValue={profile.operatingAddress} />
      </label>
      <label>
        Country
        <input name="country" defaultValue={profile.country} />
      </label>
      <label>
        Phone
        <input name="phone" defaultValue={profile.phone} />
      </label>
      <label>
        Website
        <input name="website" defaultValue={profile.website} />
      </label>
      <label>
        Compliance contact
        <input name="complianceEmail" type="email" defaultValue={profile.complianceEmail} />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
      <button type="submit">Save profile</button>
    </form>
  );
}
