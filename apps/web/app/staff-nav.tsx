'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

export function StaffNav({ tabs }: { tabs: { href: string; label: string; group: string }[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  if (tabs.length === 0) {
    return null;
  }
  const main = tabs.filter((tab) => tab.group === 'main');
  const utility = tabs.filter((tab) => tab.group === 'utility');
  return (
    <>
      <button className="nav-toggle secondary" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? 'Close menu' : 'Menu'}
      </button>
      <nav className={open ? 'open' : undefined}>
        {main.map((tab) => link(tab, pathname))}
        {utility.length > 0 ? <hr /> : null}
        {utility.map((tab) => link(tab, pathname))}
      </nav>
    </>
  );
}

function link(tab: { href: string; label: string }, pathname: string) {
  const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  return (
    <a key={tab.href} href={tab.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
      {tab.label}
    </a>
  );
}
