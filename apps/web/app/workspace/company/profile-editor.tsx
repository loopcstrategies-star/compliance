'use client';

import { FormEvent, useState } from 'react';
import type { NetworkProfile } from './network-types';

export function ProfileEditor({ profile }: { profile: NetworkProfile }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/company-network/me', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        headline: form.get('headline'),
        introduction: form.get('introduction'),
        industry: form.get('industry'),
        businessCategories: String(form.get('businessCategories') ?? ''),
        city: form.get('city'),
        country: form.get('country'),
        website: form.get('website'),
        publicEmail: form.get('publicEmail'),
        publicPhone: form.get('publicPhone'),
        productsServices: form.get('productsServices'),
        capabilities: form.get('capabilities'),
        companySize: form.get('companySize'),
        yearEstablished: form.get('yearEstablished') || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError('The networking profile was not saved.');
      return;
    }
    setMessage('Networking profile saved.');
    setOpen(false);
  }

  async function onUpload(assetType: 'logo' | 'cover', file: File | null) {
    if (!file) {
      return;
    }
    setError('');
    setMessage('');
    const body = new FormData();
    body.set('assetType', assetType);
    body.set('file', file);
    const response = await fetch('/api/company-network/me/assets', { method: 'POST', body });
    if (!response.ok) {
      setError(`The ${assetType} upload failed.`);
      return;
    }
    setMessage(`${assetType === 'logo' ? 'Logo' : 'Cover image'} uploaded.`);
  }

  return (
    <div className="network-editor">
      <div className="network-editor-actions">
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close editor' : 'Edit Profile'}
        </button>
      </div>
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {open ? (
        <form className="panel network-form" onSubmit={onSubmit}>
          <label>
            Headline
            <input name="headline" defaultValue={profile.headline} maxLength={160} />
          </label>
          <label>
            Introduction
            <textarea name="introduction" defaultValue={profile.introduction} rows={4} />
          </label>
          <label>
            Industry
            <input name="industry" defaultValue={profile.industry} />
          </label>
          <label>
            Business categories (comma-separated)
            <input name="businessCategories" defaultValue={profile.businessCategories.join(', ')} />
          </label>
          <div className="network-form-grid">
            <label>
              City
              <input name="city" defaultValue={profile.city} />
            </label>
            <label>
              Country
              <input name="country" defaultValue={profile.country} />
            </label>
          </div>
          <label>
            Website
            <input name="website" defaultValue={profile.website} />
          </label>
          <div className="network-form-grid">
            <label>
              Public business email
              <input name="publicEmail" type="email" defaultValue={profile.publicEmail} />
            </label>
            <label>
              Public business phone
              <input name="publicPhone" defaultValue={profile.publicPhone} />
            </label>
          </div>
          <label>
            Products and services
            <textarea name="productsServices" defaultValue={profile.productsServices} rows={3} />
          </label>
          <label>
            Capabilities
            <textarea name="capabilities" defaultValue={profile.capabilities} rows={3} />
          </label>
          <div className="network-form-grid">
            <label>
              Company size
              <input name="companySize" defaultValue={profile.companySize} placeholder="e.g. 11-50" />
            </label>
            <label>
              Year established
              <input name="yearEstablished" type="number" defaultValue={profile.yearEstablished ?? ''} />
            </label>
          </div>
          <label>
            Logo
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => onUpload('logo', event.target.files?.[0] ?? null)}
            />
          </label>
          <label>
            Cover image
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => onUpload('cover', event.target.files?.[0] ?? null)}
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      ) : null}
    </div>
  );
}
