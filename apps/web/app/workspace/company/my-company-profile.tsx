'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CompanyConnectionsPanel } from './company-connections-panel';
import { FeedClient } from './feed-client';
import { MemberProfileEditor } from './member-profile-editor';
import { ProfileEditor } from './profile-editor';
import type { NetworkProfile } from './network-types';

type TabId = 'overview' | 'about' | 'activity' | 'people' | 'connections';

function websiteHost(website: string) {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
  } catch {
    return website;
  }
}

export function MyCompanyProfile({ profile }: { profile: NetworkProfile }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [editorNonce, setEditorNonce] = useState(0);
  const locationLine = useMemo(
    () =>
      [profile.industry, ...(profile.businessCategories ?? []).slice(0, 2), profile.city, profile.country]
        .filter(Boolean)
        .join(' · '),
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
            {locationLine ? <p className="muted-line">{locationLine}</p> : null}
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
              <Link className="button-link button-link--outline" href="/workspace/company/connections">
                My Network
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="network-profile-tabs" role="tablist" aria-label="Company profile sections">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'about', label: 'About' },
            { id: 'activity', label: 'Activity' },
            { id: 'people', label: 'People' },
            { id: 'connections', label: 'Connections' },
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

      {tab === 'overview' ? (
        <div className="network-profile-panel" role="tabpanel">
          <div className="network-overview-grid">
            <article className="network-overview-card">
              <h2>About</h2>
              <p>{profile.introduction || 'Add an introduction so partners understand what you do.'}</p>
              <button type="button" className="button-link button-link--outline" onClick={() => setTab('about')}>
                View about
              </button>
            </article>
            <article className="network-overview-card">
              <h2>Activity</h2>
              <p>Share company updates with your network and keep partners informed.</p>
              <button type="button" className="button-link button-link--outline" onClick={() => setTab('activity')}>
                Open activity
              </button>
            </article>
            <article className="network-overview-card">
              <h2>People</h2>
              <p>Highlight the colleagues who represent your company on LoopC Network.</p>
              <button type="button" className="button-link button-link--outline" onClick={() => setTab('people')}>
                View people
              </button>
            </article>
            <article className="network-overview-card">
              <h2>Details</h2>
              <p className="muted-line">
                {[
                  profile.website || '',
                  profile.companySize ? `Size ${profile.companySize}` : '',
                  profile.yearEstablished ? `Est. ${profile.yearEstablished}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Add website, size, and year in Edit profile.'}
              </p>
            </article>
          </div>
        </div>
      ) : null}

      {tab === 'about' ? (
        <div className="network-profile-panel" role="tabpanel">
          <div className="network-profile-body">
            <h2>About</h2>
            <p>{profile.introduction || 'No introduction yet.'}</p>
            {profile.productsServices ? (
              <>
                <h2>Products and services</h2>
                <p>{profile.productsServices}</p>
              </>
            ) : null}
            {profile.capabilities ? (
              <>
                <h2>Capabilities</h2>
                <p>{profile.capabilities}</p>
              </>
            ) : null}
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
          <ProfileEditor key={editorNonce} profile={profile} defaultOpen={editorNonce > 0} compactActions />
        </div>
      ) : null}

      {tab === 'activity' ? (
        <div className="network-profile-panel" role="tabpanel">
          <FeedClient compose tenantId={profile.tenantId} />
        </div>
      ) : null}

      {tab === 'people' ? (
        <div className="network-profile-panel" role="tabpanel">
          <MemberProfileEditor />
        </div>
      ) : null}

      {tab === 'connections' ? (
        <div className="network-profile-panel" role="tabpanel">
          <CompanyConnectionsPanel />
        </div>
      ) : null}
    </section>
  );
}
