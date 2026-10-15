'use client';

import { usePathname } from 'next/navigation';

export function StaffNav({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  if (tabs.length === 0) {
    return null;
  }
  return (
    <nav>
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <a key={tab.href} href={tab.href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
