import type { ReactNode } from 'react';
import { apiGet } from '../../../lib/api';
import type { Me } from '../../../lib/session';
import { CompanyNetworkNav } from './company-network-nav';

export async function CompanyShell({ me, children }: { me: Me; children: ReactNode }) {
  const unread = await apiGet<{ count: number }>('/company-network/unread-count');
  const isSuperAdmin = me.roles.includes('super_admin');

  return (
    <>
      <header className="dash-head company-profile-head">
        <div>
          <h2>Company Profile</h2>
          <p>LoopC company networking — discover partners, manage connections, and message securely.</p>
        </div>
      </header>
      <CompanyNetworkNav unreadCount={unread?.count ?? 0} />
      {isSuperAdmin ? (
        <section className="company-admin-strip" aria-label="Platform administration">
          <a className="button-link button-link--outline" href="/workspace/company/onboarding">
            Customer onboarding
          </a>
          <a className="button-link button-link--outline" href="/workspace/company/branding">
            Company branding
          </a>
        </section>
      ) : null}
      {children}
    </>
  );
}
