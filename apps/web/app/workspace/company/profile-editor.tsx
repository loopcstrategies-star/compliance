'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { NetworkProfile } from './network-types';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'about', label: 'About' },
  { id: 'products', label: 'Products' },
  { id: 'business', label: 'Business' },
  { id: 'contact', label: 'Contact' },
  { id: 'media', label: 'Media' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export function ProfileEditor({
  profile,
  defaultOpen = false,
  compactActions = false,
}: {
  profile: NetworkProfile;
  defaultOpen?: boolean;
  compactActions?: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [section, setSection] = useState<SectionId>('overview');

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
    router.refresh();
  }

  async function onUpload(assetType: 'logo' | 'cover', file: File | null) {
    if (!file) {
      return;
    }
    setError('');
    setMessage('');
    setBusy(true);
    const body = new FormData();
    body.set('assetType', assetType);
    body.set('file', file);
    const response = await fetch('/api/company-network/me/assets', { method: 'POST', body });
    setBusy(false);
    if (!response.ok) {
      setError(`The ${assetType} upload failed.`);
      return;
    }
    setMessage(`${assetType === 'logo' ? 'Logo' : 'Cover image'} uploaded.`);
    router.refresh();
  }

  return (
    <div className="network-editor" id="company-profile-editor">
      <div className="network-editor-actions">
        <button type="button" onClick={() => setOpen((value) => !value)}>
          {open ? 'Close editor' : 'Edit profile'}
        </button>
        {compactActions ? null : (
          <>
            <a className="button-link button-link--outline" href={`/workspace/company/discover/${profile.tenantId}`}>
              Preview profile
            </a>
            <a className="button-link button-link--outline" href="/workspace/company/settings">
              Visibility settings
            </a>
          </>
        )}
      </div>
      {profile.completion ? (
        <div className="completion-meter" aria-label={`Profile ${profile.completion.percent}% complete`}>
          Profile completion {profile.completion.percent}%
          <span>
            <i style={{ width: `${profile.completion.percent}%` }} />
          </span>
          {profile.completion.missing?.length ? (
            <ul className="completion-checklist">
              {profile.completion.missing.map((item) => (
                <li key={item}>Add {item.toLowerCase()}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {message ? <p className="notice success">{message}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {open ? (
        <form className="panel network-form" onSubmit={onSubmit}>
          <div className="network-editor-tabs" role="tablist" aria-label="Profile sections">
            {SECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={section === item.id}
                className={section === item.id ? 'is-active' : undefined}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <fieldset hidden={section !== 'overview'}>
            <legend className="sr-only">Overview</legend>
            <label>
              Headline
              <input name="headline" defaultValue={profile.headline} maxLength={160} />
            </label>
            <label>
              Industry
              <input name="industry" defaultValue={profile.industry} />
            </label>
            <label>
              Company type / categories (comma-separated)
              <input name="businessCategories" defaultValue={profile.businessCategories.join(', ')} />
            </label>
          </fieldset>

          <fieldset hidden={section !== 'about'}>
            <legend className="sr-only">About</legend>
            <label>
              Introduction
              <textarea name="introduction" defaultValue={profile.introduction} rows={5} />
            </label>
            <label>
              Capabilities
              <textarea name="capabilities" defaultValue={profile.capabilities} rows={4} />
            </label>
          </fieldset>

          <fieldset hidden={section !== 'products'}>
            <legend className="sr-only">Products</legend>
            <label>
              Products and services
              <textarea name="productsServices" defaultValue={profile.productsServices} rows={5} />
            </label>
          </fieldset>

          <fieldset hidden={section !== 'business'}>
            <legend className="sr-only">Business</legend>
            <div className="network-form-grid">
              <label>
                City
                <input name="city" defaultValue={profile.city} />
              </label>
              <label>
                Country
                <input name="country" defaultValue={profile.country} />
              </label>
              <label>
                Company size
                <input name="companySize" defaultValue={profile.companySize} placeholder="e.g. 11-50" />
              </label>
              <label>
                Year established
                <input name="yearEstablished" type="number" defaultValue={profile.yearEstablished ?? ''} />
              </label>
            </div>
          </fieldset>

          <fieldset hidden={section !== 'contact'}>
            <legend className="sr-only">Contact</legend>
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
          </fieldset>

          <fieldset hidden={section !== 'media'}>
            <legend className="sr-only">Media</legend>
            <label>
              Logo
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={busy}
                onChange={(event) => onUpload('logo', event.target.files?.[0] ?? null)}
              />
            </label>
            <label>
              Cover image
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={busy}
                onChange={(event) => onUpload('cover', event.target.files?.[0] ?? null)}
              />
            </label>
            <p className="muted-line">Uploads save immediately after selection.</p>
          </fieldset>

          {section !== 'media' ? (
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
