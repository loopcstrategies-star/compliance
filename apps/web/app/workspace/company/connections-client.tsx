'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ConnectionRow } from './network-types';

export function ConnectionsClient({
  connected,
  received,
  sent,
}: {
  connected: ConnectionRow[];
  received: ConnectionRow[];
  sent: ConnectionRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  async function act(id: string, path: string) {
    setError('');
    setBusyId(id);
    const response = await fetch(path, { method: 'POST' });
    setBusyId(null);
    if (!response.ok) {
      setError('The connection action failed.');
      return;
    }
    router.refresh();
  }

  const filter = (rows: ConnectionRow[]) => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return rows;
    }
    return rows.filter((row) =>
      [row.peerName, row.headline, row.industry, row.city, row.country]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  };

  const filteredConnected = useMemo(() => filter(connected), [connected, query]);
  const filteredReceived = useMemo(() => filter(received), [received, query]);
  const filteredSent = useMemo(() => filter(sent), [sent, query]);

  return (
    <div className="network-connections">
      <div className="network-section-head">
        <h3>My Network</h3>
      </div>
      <div className="network-count-chips" aria-label="Network counts">
        <span>{connected.length} connected</span>
        <span>{received.length} received</span>
        <span>{sent.length} sent</span>
      </div>
      <label className="network-filter-bar">
        Search network
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter by company, industry, or location"
        />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      <section className="panel">
        <h3>Accepted connections</h3>
        {filteredConnected.length === 0 ? <p className="notice">No accepted connections yet.</p> : null}
        <ul className="network-list">
          {filteredConnected.map((row) => (
            <li key={row.id}>
              <div>
                <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                  <strong>{row.peerName}</strong>
                </Link>
                <p>{[row.headline, row.industry, row.city, row.country].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="connection-actions">
                <a className="button-link" href={`/workspace/company/messages?peer=${row.peerTenantId}`}>
                  Message
                </a>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busyId === row.id}
                  onClick={() => act(row.id, `/api/company-network/requests/${row.id}/disconnect`)}
                >
                  Disconnect
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3>Received requests</h3>
        {filteredReceived.length === 0 ? <p className="notice">No pending incoming requests.</p> : null}
        <ul className="network-list">
          {filteredReceived.map((row) => (
            <li key={row.id}>
              <div>
                <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                  <strong>{row.peerName}</strong>
                </Link>
                <p>{row.headline || 'Wants to connect'}</p>
                <p className="muted-line">{formatWhen(row.createdAt)}</p>
              </div>
              <div className="connection-actions">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => act(row.id, `/api/company-network/requests/${row.id}/accept`)}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  disabled={busyId === row.id}
                  onClick={() => act(row.id, `/api/company-network/requests/${row.id}/decline`)}
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3>Sent requests</h3>
        {filteredSent.length === 0 ? <p className="notice">No pending outgoing requests.</p> : null}
        <ul className="network-list">
          {filteredSent.map((row) => (
            <li key={row.id}>
              <div>
                <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                  <strong>{row.peerName}</strong>
                </Link>
                <p>Pending</p>
                <p className="muted-line">{formatWhen(row.createdAt)}</p>
              </div>
              <button
                type="button"
                className="button-secondary"
                disabled={busyId === row.id}
                onClick={() => act(row.id, `/api/company-network/requests/${row.id}/cancel`)}
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
}
