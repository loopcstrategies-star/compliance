import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { tabsForRoles } from '../lib/home';
import { SignOut } from './sign-out';
import { StaffNav } from './staff-nav';

export function Shell({ title, me, children }: { title: string; me: Me; children?: ReactNode }) {
  const staffTabs = me.roles.some((role) => role !== 'customer') ? tabsForRoles(me.roles) : [];
  const initials = me.displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <span className="monogram" aria-hidden="true">M</span>
          <span>
            <strong>MYKA</strong>
            <small>Compliance</small>
          </span>
        </div>
        {staffTabs.length > 0 ? (
          <div className="who">
            <span className="avatar" aria-hidden="true">{initials || 'M'}</span>
            <span>
              <strong>{me.displayName}</strong>
              <small>{me.email}</small>
              <em>{me.roles[0]?.replaceAll('_', ' ')}</em>
            </span>
          </div>
        ) : (
          <p className="role">{title}</p>
        )}
        <StaffNav tabs={staffTabs.map((tab) => ({ href: tab.href, label: tab.label, group: tab.group }))} />
        <div className="sidebar-foot">
          <SignOut />
          {staffTabs.length > 0 ? <p>Secure. Compliant. Trusted.</p> : null}
        </div>
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
