'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function ConnectionActions({
  tenantId,
  connectionId,
  status,
  canMessage,
  onChanged,
}: {
  tenantId: string;
  connectionId?: string | null;
  status?: string;
  canMessage?: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [localStatus, setLocalStatus] = useState(status);
  const [localConnectionId, setLocalConnectionId] = useState(connectionId);

  useEffect(() => {
    setLocalStatus(status);
    setLocalConnectionId(connectionId);
  }, [status, connectionId]);

  async function run(path: string, body?: Record<string, unknown>, nextStatus?: string) {
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
    const payload = await response.json().catch(() => null);
    if (payload?.id) {
      setLocalConnectionId(payload.id);
    }
    if (nextStatus) {
      setLocalStatus(nextStatus);
    }
    onChanged?.();
    router.refresh();
  }

  const current = localStatus ?? status;

  return (
    <div className="connection-actions">
      {current === 'none' || current === 'declined' || current === 'cancelled' || current === 'disconnected' ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => run('/api/company-network/requests', { tenantId }, 'pending_outgoing')}
        >
          Connect
        </button>
      ) : null}
      {current === 'pending_outgoing' && localConnectionId ? (
        <button
          type="button"
          className="button-secondary"
          disabled={busy}
          onClick={() => run(`/api/company-network/requests/${localConnectionId}/cancel`, undefined, 'cancelled')}
        >
          Cancel request
        </button>
      ) : null}
      {current === 'pending_incoming' && localConnectionId ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(`/api/company-network/requests/${localConnectionId}/accept`, undefined, 'connected')}
          >
            Accept
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => run(`/api/company-network/requests/${localConnectionId}/decline`, undefined, 'declined')}
          >
            Decline
          </button>
        </>
      ) : null}
      {current === 'connected' ? (
        <>
          <span className="status-chip status-chip--connected">Connected</span>
          {canMessage !== false ? (
            <a className="button-link button-link--outline" href={`/workspace/company/messages?peer=${tenantId}`}>
              Message
            </a>
          ) : null}
          {localConnectionId ? (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() =>
                run(`/api/company-network/requests/${localConnectionId}/disconnect`, undefined, 'disconnected')
              }
            >
              Disconnect
            </button>
          ) : null}
        </>
      ) : null}
      {current === 'pending_outgoing' ? <span className="status-chip">Pending</span> : null}
      {error ? <p className="notice error">{error}</p> : null}
    </div>
  );
}
