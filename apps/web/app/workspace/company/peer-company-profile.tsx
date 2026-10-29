'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ConnectionActions } from './connection-actions';
import { FeedClient } from './feed-client';
import type { NetworkProfile } from './network-types';

type TabId = 'about' | 'posts';

function websiteHost(website: string) {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
  } catch {
    return website;
  }
}

export function PeerCompanyProfile({
  profile,
  isOwn,
}: {
  profile: NetworkProfile;
  isOwn: boolean;
}) {
  const [tab, setTab] = useState<TabId>('about');
  const locationLine = useMemo(
    () =>
      [profile.industry, ...(profile.businessCategories ?? []).slice(0, 2), profile.city, profile.country]
        .filter(Boolean)
        .join(' · '),
    [profile],
  );

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
            <p className="network-profile-headline">{profile.headline || 'No headline'}</p>
            {locationLine ? <p className="muted-line">{locationLine}</p> : null}
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
            <div className="network-profile-actions">
              {isOwn ? (
                <Link className="button-link" href="/workspace/company/my">
                  Edit your company
                </Link>
              ) : (
                <ConnectionActions
                  tenantId={profile.tenantId}
                  connectionId={profile.connectionId}
                  status={profile.connectionStatus}
                  canMessage={profile.canMessage}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="network-profile-tabs" role="tablist" aria-label="Company profile sections">
        {(
          [
            { id: 'about', label: 'About' },
            { id: 'posts', label: 'Posts' },
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
        <div className="network-profile-panel network-profile-body" role="tabpanel">
          <h2>About</h2>
          <p>{profile.introduction || 'No introduction published.'}</p>
          <h2>Products and services</h2>
          <p>{profile.productsServices || 'Not published.'}</p>
          <h2>Capabilities</h2>
          <p>{profile.capabilities || 'Not published.'}</p>
          <h2>Public contact</h2>
          <p>
            {[profile.website, profile.publicEmail, profile.publicPhone].filter(Boolean).join(' · ') ||
              'No public contact details.'}
          </p>
        </div>
      ) : null}

      {tab === 'posts' ? (
        <div className="network-profile-panel" role="tabpanel">
          <FeedClient tenantId={profile.tenantId} />
        </div>
      ) : null}
    </section>
  );
}
