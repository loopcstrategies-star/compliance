'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BellIcon } from './network-icons';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [unread, list] = await Promise.all([
        fetch('/api/company-network/notifications/unread-count'),
        fetch('/api/company-network/notifications?pageSize=8'),
      ]);
      if (unread.ok) {
        const payload = await unread.json();
        setCount(payload.count ?? 0);
      } else if (unread.status !== 403) {
        setError('Could not refresh notifications.');
      }
      if (list.ok) {
        const payload = await list.json();
        setItems(payload.items ?? []);
      } else if (list.status === 403) {
        setItems([]);
      } else {
        setError('Could not load notifications.');
      }
    } catch {
      setError('Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
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
    <div className="network-notify" ref={root}>
      <button
        type="button"
        className="network-shell-icon-link network-shell-icon-link--icon"
        aria-label={count > 0 ? `Notifications, ${count} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          if (!open) {
            void refresh();
          }
        }}
      >
        <BellIcon />
        <span className="network-shell-icon-label">Notifications</span>
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
          {loading ? <p className="notice">Loading…</p> : null}
          {error ? <p className="notice error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? <p className="notice">No notifications yet.</p> : null}
          <ul className="network-list">
            {items.map((item) => (
              <li key={item.id} className={item.readAt ? undefined : 'is-unread'}>
                <div>
                  <strong>{labelFor(item.type)}</strong>
                  <p className="muted-line">
                    {item.payload?.preview || new Date(item.createdAt).toLocaleString()}
                    {item.readAt ? '' : ' · unread'}
                  </p>
                  {item.payload?.href ? (
                    <Link href={item.payload.href} onClick={() => setOpen(false)}>
                      Open
                    </Link>
                  ) : null}
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
