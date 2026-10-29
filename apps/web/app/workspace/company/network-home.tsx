'use client';

import Link from 'next/link';
import { ConnectionActions } from './connection-actions';
import type { ConnectionRow, ConversationRow, NetworkProfile } from './network-types';

export type NetworkHomeData = {
  profile: NetworkProfile;
  suggestions: Array<NetworkProfile & { connectionStatus: string; connectionId: string | null }>;
  suggestionTotal: number;
  receivedRequests: ConnectionRow[];
  receivedCount: number;
  recentConversations: ConversationRow[];
  unreadCount: number;
  connectionCount: number;
};

export function NetworkHome({ data }: { data: NetworkHomeData }) {
  const { profile } = data;
  const incomplete = (profile.completion?.percent ?? 100) < 100;

  return (
    <div className="network-home">
      <section className="network-home-hero panel network-profile">
        <div
          className="network-cover"
          style={{
            backgroundImage: profile.hasCover
              ? `url(/api/company-network/companies/${profile.tenantId}/cover)`
              : undefined,
          }}
        >
          {profile.website ? <span className="network-cover-badge">{stripHost(profile.website)}</span> : null}
        </div>
        <div className="network-profile-head">
          {profile.hasLogo ? (
            <img
              className="network-logo"
              src={`/api/company-network/companies/${profile.tenantId}/logo`}
              alt={`${profile.companyName} logo`}
            />
          ) : (
            <div className="network-logo network-logo--placeholder" aria-hidden="true">
              {(profile.companyName || 'C').slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="network-home-identity">
            <h3>{profile.companyName}</h3>
            <p>{profile.headline || 'Add a headline to introduce your company.'}</p>
            <p className="muted-line">
              {[profile.industry, profile.city, profile.country].filter(Boolean).join(' · ') ||
                'Location not set'}
            </p>
            <p className="muted-line">
              {data.connectionCount} connections
              {profile.discoverable ? ' · Discoverable' : ' · Hidden from discovery'}
            </p>
            <div className="network-home-actions">
              <Link className="button-link" href="/workspace/company/my">
                Edit profile
              </Link>
              <Link className="button-link button-link--outline" href={`/workspace/company/discover/${profile.tenantId}`}>
                View profile
              </Link>
              <Link className="button-link button-link--outline" href="/workspace/company/messages">
                Messages
                {data.unreadCount > 0 ? ` (${data.unreadCount})` : ''}
              </Link>
            </div>
          </div>
        </div>
        {incomplete ? (
          <div className="network-completion-prompt">
            <p>
              Profile {profile.completion?.percent ?? 0}% complete. Finish your company profile to improve discovery.
            </p>
            {profile.completion?.missing?.length ? (
              <ul>
                {profile.completion.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <Link className="button-link" href="/workspace/company/my">
              Complete profile
            </Link>
          </div>
        ) : null}
      </section>

      <section className="network-shortcut-grid" aria-label="Network shortcuts">
        <Link className="network-shortcut-card" href="/workspace/company/my">
          <strong>Company profile</strong>
          <span>About, industry, services and contact details.</span>
        </Link>
        <Link className="network-shortcut-card" href="/workspace/company/connections">
          <strong>My network</strong>
          <span>
            {data.connectionCount} connections
            {data.receivedCount > 0 ? ` · ${data.receivedCount} pending` : ''}
          </span>
        </Link>
        <Link className="network-shortcut-card" href="/workspace/company/messages">
          <strong>Messages</strong>
          <span>
            Private business conversations
            {data.unreadCount > 0 ? ` · ${data.unreadCount} unread` : ''}
          </span>
        </Link>
        <Link className="network-shortcut-card" href="/workspace/company/discover">
          <strong>Discover</strong>
          <span>Find partners by industry, location, and services.</span>
        </Link>
      </section>

      <div className="network-home-columns">
        <section className="panel">
          <div className="network-section-head">
            <h3>Suggested companies</h3>
            <Link href="/workspace/company/discover">See all</Link>
          </div>
          {data.suggestions.length === 0 ? (
            <p className="notice">No discoverable companies yet. Check back as more partners join LoopC Network.</p>
          ) : (
            <div className="company-card-grid">
              {data.suggestions.map((company) => (
                <article key={company.tenantId} className="company-network-card">
                  <div className="company-network-card-head">
                    <img
                      src={`/api/company-network/companies/${company.tenantId}/logo`}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <div>
                      <h3>
                        <Link href={`/workspace/company/discover/${company.tenantId}`}>{company.companyName}</Link>
                      </h3>
                      <p>{company.headline || 'No headline yet'}</p>
                    </div>
                  </div>
                  <p className="muted-line">
                    {[company.industry, company.city, company.country].filter(Boolean).join(' · ') ||
                      'Location not set'}
                  </p>
                  <ConnectionActions
                    tenantId={company.tenantId}
                    connectionId={company.connectionId}
                    status={company.connectionStatus}
                  />
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="network-home-side">
          <section className="panel">
            <div className="network-section-head">
              <h3>Connection requests</h3>
              <Link href="/workspace/company/connections">Manage</Link>
            </div>
            {data.receivedRequests.length === 0 ? (
              <p className="notice">No pending incoming requests.</p>
            ) : (
              <ul className="network-list">
                {data.receivedRequests.map((row) => (
                  <li key={row.id}>
                    <div>
                      <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                        <strong>{row.peerName}</strong>
                      </Link>
                      <p className="muted-line">{row.headline || 'Wants to connect'}</p>
                    </div>
                    <ConnectionActions
                      tenantId={row.peerTenantId}
                      connectionId={row.id}
                      status="pending_incoming"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="network-section-head">
              <h3>Recent conversations</h3>
              <Link href="/workspace/company/messages">Open inbox</Link>
            </div>
            {data.recentConversations.length === 0 ? (
              <p className="notice">No conversations yet. Connect with a company to start messaging.</p>
            ) : (
              <ul className="network-list">
                {data.recentConversations.map((row) => (
                  <li key={row.id}>
                    <div>
                      <Link href={`/workspace/company/messages?peer=${row.peerTenantId}`}>
                        <strong>{row.peerName}</strong>
                      </Link>
                      <p className="muted-line">
                        {row.lastMessage?.body || 'No messages yet'}
                        {row.unreadCount > 0 ? ` · ${row.unreadCount} unread` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function stripHost(website: string) {
  try {
    return new URL(website.startsWith('http') ? website : `https://${website}`).hostname;
  } catch {
    return website;
  }
}
