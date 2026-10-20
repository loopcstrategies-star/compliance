import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { tabsForRoles } from '../lib/home';
import { SignOut } from './sign-out';
import { StaffAvatar } from './staff-avatar';
import { StaffNav } from './staff-nav';

function roleLabel(role: string | undefined) {
  if (!role) {
    return '';
  }
  return role
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

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
          <span className="monogram" aria-hidden="true">
            LC
          </span>
          <span>
            <strong>LoopC</strong>
            <small>Compliance</small>
          </span>
        </div>
        {staffTabs.length > 0 ? (
          <div className="who">
            <StaffAvatar initials={initials || 'LC'} />
            <span>
              <strong>{me.displayName}</strong>
              <small>{me.email}</small>
              <em className="role-chip">{roleLabel(me.roles[0])}</em>
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
