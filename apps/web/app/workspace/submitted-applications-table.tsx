'use client';

import { useMemo, useState } from 'react';

export type SubmittedApplicationItem = {
  id: string;
  status: string;
  legalName: string;
  customerType: string;
  submittedAt: string | null;
};

function titleCaseType(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function statusLabel(status: string): string {
  if (status === 'submitted') return 'Submitted';
  if (status === 'maker_review' || status === 'checker_review' || status === 'reassessment') return 'In Review';
  return status.replaceAll('_', ' ');
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function SubmittedApplicationsTable({
  items,
  tenantId,
}: {
  items: SubmittedApplicationItem[];
  tenantId: string;
}) {
  const [query, setQuery] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => {
      const haystack = `${item.id} ${item.legalName} ${item.customerType} ${item.status}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query]);

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setCopiedId('');
    }
  }

  return (
    <section className="panel submitted-apps">
      <header className="panel-head submitted-apps-head">
        <h3>Submitted Applications</h3>
        <p className="notice">{items.length} record{items.length === 1 ? '' : 's'}</p>
      </header>
      <div className="filters">
        <label>
          Search
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Application ID, name, type, or status"
          />
        </label>
        <span />
      </div>
      {shown.length === 0 ? (
        <p className="notice">
          {items.length === 0
            ? 'No submitted applications are waiting for a first review.'
            : 'No applications match this search.'}
        </p>
      ) : (
        <div className="submitted-apps-table-wrap">
          <table className="queue submitted-apps-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Application Name</th>
                <th>Type</th>
                <th>Submitted On</th>
                <th>Status</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="submitted-app-id" title={item.id}>
                      {shortId(item.id)}
                    </span>
                    <button type="button" className="button-link button-link--outline submitted-copy" onClick={() => void copyId(item.id)}>
                      {copiedId === item.id ? 'Copied' : 'Copy'}
                    </button>
                  </td>
                  <td>{item.legalName}</td>
                  <td>{titleCaseType(item.customerType)}</td>
                  <td>
                    {item.submittedAt ? (
                      new Date(item.submittedAt).toLocaleString()
                    ) : (
                      <span className="notice" title="Active submission timestamp missing">
                        Unavailable
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={`chip ${item.status}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td>
                    <a className="button-link" href={`/workspace/cases/${item.id}?tenant=${encodeURIComponent(tenantId)}`}>
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
