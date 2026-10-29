'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronIcon } from './network-icons';

export function NetworkAccountMenu({ displayName, email }: { displayName: string; email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="network-account-menu" ref={root}>
      <button
        type="button"
        className="network-shell-account network-shell-account--button"
        aria-expanded={open}
        aria-haspopup="menu"
        title={email}
        onClick={() => setOpen((value) => !value)}
      >
        <span>{displayName || email}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <div className="network-account-panel" role="menu" aria-label="Account">
          <p className="muted-line">{email}</p>
          <Link role="menuitem" href="/workspace/company/my" onClick={() => setOpen(false)}>
            My Company
          </Link>
          <Link role="menuitem" href="/workspace/company/settings" onClick={() => setOpen(false)}>
            Company Settings
          </Link>
          <Link role="menuitem" href="/workspace/company/connections" onClick={() => setOpen(false)}>
            My Network
          </Link>
          <button type="button" role="menuitem" className="network-account-signout" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
