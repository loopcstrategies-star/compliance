'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ConnectionRow } from './network-types';

export function CompanyConnectionsPanel() {
  const [rows, setRows] = useState<ConnectionRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const response = await fetch('/api/company-network/connections');
      if (!response.ok) {
        if (!cancelled) {
          setError('Connections could not be loaded.');
          setLoading(false);
        }
        return;
      }
      const payload = await response.json();
      if (!cancelled) {
        setRows(payload ?? []);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="notice">Loading connections…</p>;
  }
  if (error) {
    return <p className="notice error">{error}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="notice">
        No accepted connections yet.{' '}
        <Link href="/workspace/company/discover">Discover companies</Link>
      </p>
    );
  }

  return (
    <ul className="network-list">
      {rows.map((row) => (
        <li key={row.id}>
          <div>
            <strong>
              <Link href={`/workspace/company/discover/${row.peerTenantId}`}>{row.peerName}</Link>
            </strong>
            <p className="muted-line">
              {[row.industry, row.city, row.country].filter(Boolean).join(' · ') || row.headline || 'Connected company'}
            </p>
          </div>
          <div className="network-editor-actions">
            <Link className="button-link button-link--outline" href={`/workspace/company/messages?peer=${row.peerTenantId}`}>
              Message
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
