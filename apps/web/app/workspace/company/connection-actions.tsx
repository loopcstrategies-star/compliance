'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ConnectionActions({
  tenantId,
  connectionId,
  status,
  canMessage,
}: {
  tenantId: string;
  connectionId?: string | null;
  status?: string;
  canMessage?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const response = await fetch(path, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.message ?? 'The action could not be completed.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="connection-actions">
      {status === 'none' || status === 'declined' || status === 'cancelled' || status === 'disconnected' ? (
        <button type="button" disabled={busy} onClick={() => run('/api/company-network/requests', { tenantId })}>
          Send Connection Request
        </button>
      ) : null}
      {status === 'pending_outgoing' && connectionId ? (
        <button type="button" disabled={busy} onClick={() => run(`/api/company-network/requests/${connectionId}/cancel`)}>
          Cancel Request
        </button>
      ) : null}
      {status === 'pending_incoming' && connectionId ? (
        <>
          <button type="button" disabled={busy} onClick={() => run(`/api/company-network/requests/${connectionId}/accept`)}>
            Accept Request
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => run(`/api/company-network/requests/${connectionId}/decline`)}
          >
            Decline
          </button>
        </>
      ) : null}
      {status === 'connected' ? (
        <>
          <span className="status-chip status-chip--connected">Connected</span>
          {canMessage ? (
            <a className="button-link" href={`/workspace/company/messages?peer=${tenantId}`}>
              Message
            </a>
          ) : null}
          {connectionId ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => run(`/api/company-network/requests/${connectionId}/disconnect`)}
            >
              Disconnect
            </button>
          ) : null}
        </>
      ) : null}
      {status === 'pending_outgoing' ? <span className="status-chip">Pending</span> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
