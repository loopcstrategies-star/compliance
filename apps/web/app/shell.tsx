import type { ReactNode } from 'react';
import type { Me } from '../lib/session';
import { SignOut } from './sign-out';

export function Shell({ title, me, children }: { title: string; me: Me; children?: ReactNode }) {
  return (
    <main>
      <h1>{title}</h1>
      <p className="notice">
        Signed in as {me.displayName} ({me.email}). Role: {me.roles.join(', ')}.
      </p>
      {children}
      <SignOut />
    </main>
  );
}
