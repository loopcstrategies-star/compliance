'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FeedClient } from './feed-client';
import { MemberProfileEditor } from './member-profile-editor';
import { ProfileEditor } from './profile-editor';
import type { NetworkProfile } from './network-types';

type TabId = 'about' | 'posts' | 'people';

function websiteHost(website: string) {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
  } catch {
    return website;
  }
}

export function MyCompanyProfile({ profile }: { profile: NetworkProfile }) {
  const [tab, setTab] = useState<TabId>('about');
  const [editorNonce, setEditorNonce] = useState(0);
  const locationLine = useMemo(
    () =>
      [profile.industry, ...(profile.businessCategories ?? []).slice(0, 2), profile.city, profile.country]
        .filter(Boolean)
        .join(' · ') || 'Location not set',
    [profile],
  );

  function openEditor() {
    setTab('about');
    setEditorNonce((value) => value + 1);
    requestAnimationFrame(() => {
      document.getElementById('company-profile-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  return (
    <section className="network-profile network-profile--linkedin">
      <div className="network-profile-hero">
        <div
          className="network-cover network-cover--hero"
          style={{
            backgroundImage: profile.hasCover
              ? `url(/api/company-network/companies/${profile.tenantId}/cover)`
              : undefined,
          }}
        >
          {profile.website ? <span className="network-cover-badge">{websiteHost(profile.website)}</span> : null}
        </div>
        <div className="network-profile-identity">
          {profile.hasLogo ? (
            <img
              className="network-logo network-logo--hero"
              src={`/api/company-network/companies/${profile.tenantId}/logo`}
              alt={`${profile.companyName} logo`}
            />
          ) : (
            <div className="network-logo network-logo--hero network-logo--placeholder" aria-hidden="true">
              {(profile.companyName || 'C').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="network-profile-identity-copy">
            <h1 className="network-profile-name">{profile.companyName}</h1>
            <p className="network-profile-headline">{profile.headline || 'Add a headline to introduce your company.'}</p>
            <p className="muted-line">{locationLine}</p>
            <p className="muted-line network-profile-meta">
              <span className="status-chip">{profile.visibility}</span>
              {profile.discoverable ? (
                <span className="status-chip status-chip--connected">Discoverable</span>
              ) : (
                <span className="status-chip">Hidden from discovery</span>
              )}
              {typeof profile.connectionCount === 'number' ? (
                <span>{profile.connectionCount} connections</span>
              ) : null}
            </p>
            <div className="network-profile-actions">
              <button type="button" className="button-link" onClick={openEditor}>
                Edit profile
              </button>
              <Link className="button-link button-link--outline" href="/workspace/company/settings">
                Settings
              </Link>
              <Link
                className="button-link button-link--outline"
                href={`/workspace/company/discover/${profile.tenantId}`}
              >
                Preview
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="network-profile-tabs" role="tablist" aria-label="Company profile sections">
        {(
          [
            { id: 'about', label: 'About' },
            { id: 'posts', label: 'Posts' },
            { id: 'people', label: 'People' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'is-active' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'about' ? (
        <div className="network-profile-panel" role="tabpanel">
          <div className="network-profile-body">
            <h2>About</h2>
            <p>{profile.introduction || 'No introduction yet.'}</p>
            <h2>Products and services</h2>
            <p>{profile.productsServices || 'Not provided.'}</p>
            <h2>Capabilities</h2>
            <p>{profile.capabilities || 'Not provided.'}</p>
            <h2>Public contact</h2>
            <p>
              {[profile.website, profile.publicEmail, profile.publicPhone].filter(Boolean).join(' · ') ||
                'No public contact details.'}
            </p>
            {(profile.companySize || profile.yearEstablished) && (
              <p className="muted-line">
                {[
                  profile.companySize ? `Size ${profile.companySize}` : '',
                  profile.yearEstablished ? `Est. ${profile.yearEstablished}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>
          <ProfileEditor
            key={editorNonce}
            profile={profile}
            defaultOpen={editorNonce > 0}
            compactActions
          />
        </div>
      ) : null}

      {tab === 'posts' ? (
        <div className="network-profile-panel" role="tabpanel">
          <FeedClient compose tenantId={profile.tenantId} />
        </div>
      ) : null}

      {tab === 'people' ? (
        <div className="network-profile-panel" role="tabpanel">
          <MemberProfileEditor />
        </div>
      ) : null}
    </section>
  );
}
