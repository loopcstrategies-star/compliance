'use client';

import { useMemo, useState } from 'react';

export type QueueItem = {
  id: string;
  status: string;
  legalName: string;
  customerType: string;
  assignee: string;
  createdAt: string;
  statusChangedAt: string;
  submittedAt?: string | null;
  overdue: boolean;
  documentVersion: number;
};

function label(value: string): string {
  return value.replaceAll('_', ' ');
}

export function QueueTable({
  items,
  tenantId,
  empty,
  showOverdue,
}: {
  items: QueueItem[];
  tenantId: string;
  empty: string;
  showOverdue?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const shown = useMemo(
    () =>
      items.filter((item) => {
        const haystack = `${item.legalName} ${item.customerType} ${item.status} ${item.assignee}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase()) && (!overdueOnly || item.overdue);
      }),
    [items, overdueOnly, query],
  );

  return (
    <section className="panel">
      <div className="filters">
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Legal name, type, or status" />
        </label>
        {showOverdue ? (
          <label>
            Timing
            <select value={overdueOnly ? 'overdue' : 'all'} onChange={(event) => setOverdueOnly(event.target.value === 'overdue')}>
              <option value="all">All waiting</option>
              <option value="overdue">Overdue only</option>
            </select>
          </label>
        ) : (
          <span />
        )}
      </div>
      {shown.length === 0 ? <p className="notice">{empty}</p> : null}
      {shown.length > 0 ? (
        <table className="queue">
          <thead>
            <tr>
              <th>Application</th>
              <th>Applicant</th>
              <th>Type</th>
              <th>Status changed</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.legalName}</td>
                <td>{label(item.customerType)}</td>
                <td>{new Date(item.statusChangedAt).toLocaleString()}</td>
                <td>
                  <span className={`chip ${item.overdue ? 'overdue' : item.status}`}>{label(item.status)}</span>
                </td>
                <td>{item.assignee || 'Unassigned'}</td>
                <td>
                  <a href={`/workspace/cases/${item.id}?tenant=${tenantId}`}>Review</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}
