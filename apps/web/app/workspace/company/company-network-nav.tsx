'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { COMPANY_NETWORK_TABS } from '../../../lib/home';

export function CompanyNetworkNav({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();
  return (
    <nav className="company-network-nav" aria-label="Company networking">
      {COMPANY_NETWORK_TABS.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href !== '/workspace/company/my' && pathname.startsWith(`${tab.href}/`)) ||
          (tab.href === '/workspace/company/my' && (pathname === '/workspace/company' || pathname === '/workspace/company/my'));
        return (
          <Link key={tab.href} href={tab.href} className={active ? 'is-active' : undefined}>
            {tab.label}
            {tab.href === '/workspace/company/messages' && unreadCount > 0 ? (
              <span className="unread-pill" aria-label={`${unreadCount} unread`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
