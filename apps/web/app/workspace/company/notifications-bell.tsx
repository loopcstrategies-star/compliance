'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type NotificationRow = {
  id: string;
  type: string;
  payload: { href?: string; preview?: string; fromTenantId?: string };
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell({ initialCount = 0 }: { initialCount?: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<NotificationRow[]>([]);

  async function refresh() {
    const [unread, list] = await Promise.all([
      fetch('/api/company-network/notifications/unread-count'),
      fetch('/api/company-network/notifications?pageSize=8'),
    ]);
    if (unread.ok) {
      const payload = await unread.json();
      setCount(payload.count ?? 0);
    }
    if (list.ok) {
      const payload = await list.json();
      setItems(payload.items ?? []);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, []);

  async function markAll() {
    await fetch('/api/company-network/notifications/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    await refresh();
  }

  return (
    <div className="network-notify">
      <button type="button" className="network-shell-icon-link" onClick={() => setOpen((v) => !v)}>
        Notifications
        {count > 0 ? <span className="unread-pill">{count > 99 ? '99+' : count}</span> : null}
      </button>
      {open ? (
        <div className="network-notify-panel" role="dialog" aria-label="Notifications">
          <div className="network-section-head">
            <strong>Notifications</strong>
            <button type="button" className="button-secondary" onClick={() => void markAll()}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? <p className="notice">No notifications yet.</p> : null}
          <ul className="network-list">
            {items.map((item) => (
              <li key={item.id}>
                <div>
                  <strong>{labelFor(item.type)}</strong>
                  <p className="muted-line">
                    {item.payload?.preview || new Date(item.createdAt).toLocaleString()}
                    {item.readAt ? '' : ' · unread'}
                  </p>
                  {item.payload?.href ? <Link href={item.payload.href}>Open</Link> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function labelFor(type: string) {
  switch (type) {
    case 'connection_request':
      return 'Connection request';
    case 'connection_accepted':
      return 'Connection accepted';
    case 'new_message':
      return 'New message';
    case 'feed_comment':
      return 'Comment on your update';
    default:
      return type;
  }
}
