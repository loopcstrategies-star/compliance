import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { tabsForRoles } from '../lib/home';
import { SignOut } from './sign-out';

export function Shell({ title, me, children }: { title: string; me: Me; children?: ReactNode }) {
  const tabs = tabsForRoles(me.roles).filter((tab) => tab.href !== '/portal' || me.roles.some((role) => role !== 'customer'));
  const staffTabs = me.roles.some((role) => role !== 'customer') ? tabs : [];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="brand">MYKA</p>
        <h1>{title}</h1>
        <p>{me.displayName}</p>
        <p>{me.email}</p>
        <p className="role">{me.roles.join(', ')}</p>
        {staffTabs.length > 0 ? (
          <nav>
            {staffTabs.map((tab) => (
              <a key={tab.href} href={tab.href}>
                {tab.label}
              </a>
            ))}
          </nav>
        ) : null}
        <SignOut />
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
