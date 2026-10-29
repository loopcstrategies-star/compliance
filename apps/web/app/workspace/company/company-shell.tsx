import type { ReactNode } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/api';
import type { Me } from '../../../lib/session';
import { CompanyNetworkNav } from './company-network-nav';
import { MessageIcon } from './network-icons';
import { NetworkAccountMenu } from './network-account-menu';
import { NetworkSearch } from './network-search';
import { NotificationsBell } from './notifications-bell';

export async function CompanyShell({ me, children }: { me: Me; children: ReactNode }) {
  const [unread, notificationUnread] = await Promise.all([
    apiGet<{ count: number }>('/company-network/unread-count'),
    apiGet<{ count: number }>('/company-network/notifications/unread-count'),
  ]);
  const isSuperAdmin = me.roles.includes('super_admin');
  const messageCount = unread?.count ?? 0;

  return (
    <div className="network-shell">
      <header className="network-shell-header">
        <Link className="network-shell-brand" href="/workspace/company">
          <div className="network-shell-mark" aria-hidden="true" />
          <div>
            <h2>LoopC Network</h2>
            <p>Trusted business connections.</p>
          </div>
        </Link>
        <div className="network-shell-tools">
          <NotificationsBell initialCount={notificationUnread?.count ?? 0} />
          <Link
            className="network-shell-icon-link network-shell-icon-link--icon"
            href="/workspace/company/messages"
            aria-label={messageCount > 0 ? `Messages, ${messageCount} unread` : 'Messages'}
          >
            <MessageIcon />
            <span className="network-shell-icon-label">Messages</span>
            {messageCount > 0 ? (
              <span className="unread-pill">{messageCount > 99 ? '99+' : messageCount}</span>
            ) : null}
          </Link>
          <NetworkAccountMenu displayName={me.displayName || me.email} email={me.email} />
        </div>
      </header>
      <NetworkSearch />
      <CompanyNetworkNav unreadCount={messageCount} />
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
