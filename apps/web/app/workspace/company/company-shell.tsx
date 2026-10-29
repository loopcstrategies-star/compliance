import type { ReactNode } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import type { Me } from '../../../lib/session';
import { CompanyNetworkNav } from './company-network-nav';
import { NetworkSearch } from './network-search';

export async function CompanyShell({ me, children }: { me: Me; children: ReactNode }) {
  const unread = await apiGet<{ count: number }>('/company-network/unread-count');
  const isSuperAdmin = me.roles.includes('super_admin');

  return (
    <div className="network-shell">
      <header className="network-shell-header">
        <div className="network-shell-brand">
          <div className="network-shell-mark" aria-hidden="true" />
          <div>
            <h2>LoopC Network</h2>
            <p>Trusted business connections.</p>
          </div>
        </div>
        <div className="network-shell-tools">
          <Link
            className="network-shell-icon-link"
            href="/workspace/company/messages"
            aria-label={
              unread && unread.count > 0 ? `Messages, ${unread.count} unread` : 'Messages'
            }
          >
            Messages
            {unread && unread.count > 0 ? (
              <span className="unread-pill">{unread.count > 99 ? '99+' : unread.count}</span>
            ) : null}
          </Link>
          <span className="network-shell-account" title={me.email}>
            {me.displayName || me.email}
          </span>
        </div>
      </header>
      <NetworkSearch />
      <CompanyNetworkNav unreadCount={unread?.count ?? 0} />
      {isSuperAdmin ? (
        <section className="company-admin-strip" aria-label="Platform administration">
          <span className="company-admin-strip-label">Platform admin</span>
          <a className="button-link button-link--outline" href="/workspace/company/onboarding">
            Customer onboarding
          </a>
          <a className="button-link button-link--outline" href="/workspace/company/branding">
            Company branding
          </a>
        </section>
      ) : null}
      <div className="network-shell-body">{children}</div>
    </div>
  );
}
