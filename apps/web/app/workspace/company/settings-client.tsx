'use client';

import { FormEvent, useState } from 'react';
import type { NetworkProfile } from './network-types';

export function SettingsClient({ profile }: { profile: NetworkProfile }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/company-network/me/visibility', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        discoverable: form.get('discoverable') === 'on',
        visibility: form.get('visibility'),
        messagingEnabled: form.get('messagingEnabled') === 'on',
      }),
    });
    if (!response.ok) {
      setBusy(false);
      setError('Settings were not saved.');
      return;
    }
    const publicResponse = await fetch('/api/company-network/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicEmail: form.get('publicEmail'),
        publicPhone: form.get('publicPhone'),
        website: form.get('website'),
        companySize: form.get('companySize'),
        yearEstablished: form.get('yearEstablished') || null,
      }),
    });
    setBusy(false);
    if (!publicResponse.ok) {
      setError('Visibility saved, but public contact details were not updated.');
      return;
    }
    setMessage('Company networking settings saved.');
  }

  return (
    <form className="panel network-form" onSubmit={onSubmit}>
      <h3>Company Settings</h3>
      <p className="notice">Privacy settings are enforced by the LoopC API. Changing visibility does not delete history.</p>
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      <label className="checkbox-row">
        <input name="discoverable" type="checkbox" defaultChecked={profile.discoverable} />
        Allow this company to appear in Discover Companies
      </label>
      <label>
        Public profile visibility
        <select name="visibility" defaultValue={profile.visibility}>
          <option value="private">Private</option>
          <option value="connections">Connections only</option>
          <option value="public">Public (with discovery)</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input name="messagingEnabled" type="checkbox" defaultChecked={profile.messagingEnabled} />
        Allow messaging with accepted connections
      </label>
      <label>
        Public business email
        <input name="publicEmail" type="email" defaultValue={profile.publicEmail} />
      </label>
      <label>
        Public business phone
        <input name="publicPhone" defaultValue={profile.publicPhone} />
      </label>
      <label>
        Website
        <input name="website" defaultValue={profile.website} />
      </label>
      <div className="network-form-grid">
        <label>
          Company size
          <input name="companySize" defaultValue={profile.companySize} />
        </label>
        <label>
          Year established
          <input name="yearEstablished" type="number" defaultValue={profile.yearEstablished ?? ''} />
        </label>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
}
