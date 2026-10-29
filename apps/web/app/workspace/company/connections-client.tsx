'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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

  async function act(path: string) {
    setError('');
    const response = await fetch(path, { method: 'POST' });
    if (!response.ok) {
      setError('The connection action failed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="network-connections">
      {error ? <p className="notice error">{error}</p> : null}
      <section className="panel">
        <h3>My Connections</h3>
        {connected.length === 0 ? <p className="notice">No accepted connections yet.</p> : null}
        <ul className="network-list">
          {connected.map((row) => (
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
                <button type="button" className="button-secondary" onClick={() => act(`/api/company-network/requests/${row.id}/disconnect`)}>
                  Disconnect
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3>Received Requests</h3>
        {received.length === 0 ? <p className="notice">No pending incoming requests.</p> : null}
        <ul className="network-list">
          {received.map((row) => (
            <li key={row.id}>
              <div>
                <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                  <strong>{row.peerName}</strong>
                </Link>
                <p>{row.headline || 'Wants to connect'}</p>
              </div>
              <div className="connection-actions">
                <button type="button" onClick={() => act(`/api/company-network/requests/${row.id}/accept`)}>
                  Accept
                </button>
                <button type="button" className="button-secondary" onClick={() => act(`/api/company-network/requests/${row.id}/decline`)}>
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h3>Sent Requests</h3>
        {sent.length === 0 ? <p className="notice">No pending outgoing requests.</p> : null}
        <ul className="network-list">
          {sent.map((row) => (
            <li key={row.id}>
              <div>
                <Link href={`/workspace/company/discover/${row.peerTenantId}`}>
                  <strong>{row.peerName}</strong>
                </Link>
                <p>Pending</p>
              </div>
              <button type="button" className="button-secondary" onClick={() => act(`/api/company-network/requests/${row.id}/cancel`)}>
                Cancel
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
