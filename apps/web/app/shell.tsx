import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { SignOut } from './sign-out';

export function Shell({ title, me, children }: { title: string; me: Me; children?: ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <p className="brand">MYKA</p>
        <h1>{title}</h1>
        <p>{me.displayName}</p>
        <p>{me.email}</p>
        <p className="role">{me.roles.join(', ')}</p>
        <SignOut />
      </aside>
      <main className="workspace">{children}</main>
    </div>
  );
}
