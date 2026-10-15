import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { tabsForRoles } from '../lib/home';
import { SignOut } from './sign-out';
import { StaffNav } from './staff-nav';

export function Shell({ title, me, children }: { title: string; me: Me; children?: ReactNode }) {
  const staffTabs = me.roles.some((role) => role !== 'customer') ? tabsForRoles(me.roles) : [];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="brand">MYKA</p>
        <h1>{title}</h1>
        <p>{me.displayName}</p>
        <p>{me.email}</p>
        <p className="role">{me.roles.join(', ')}</p>
        <StaffNav tabs={staffTabs.map((tab) => ({ href: tab.href, label: tab.label }))} />
        <SignOut />
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
