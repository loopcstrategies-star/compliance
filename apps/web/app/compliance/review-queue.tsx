'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export type ReviewCase = {
  id: string;
  status: string;
  documentVersion: number;
  customer: { legalName: string; customerType: string };
};

const STAGE_FOR: Record<string, string> = {
  submitted: 'maker',
  reassessment: 'maker',
  maker_review: 'checker',
  checker_review: 'authorised_approver',
};

export function ReviewQueue({ cases, roles }: { cases: ReviewCase[]; roles: string[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const statuses = [...new Set(cases.map((item) => item.status))];
  const shown = cases.filter((item) => {
    const haystack = `${item.customer.legalName} ${item.customer.customerType} ${item.status}`.toLowerCase();
    const matchesQuery = haystack.includes(query.trim().toLowerCase());
    return matchesQuery && (status === 'all' || item.status === status);
  });

  async function decide(event: FormEvent<HTMLFormElement>, item: ReviewCase) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const outcome = submitter?.value === 'return' ? 'return' : 'accept';
    const response = await fetch(`/api/applications/${item.id}/decisions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stage: STAGE_FOR[item.status],
        outcome,
        reason: form.get('reason'),
        documentVersion: item.documentVersion,
      }),
    });
    if (!response.ok) {
      setError('The decision was not recorded.');
      return;
    }
    setMessage('Decision recorded.');
    router.refresh();
  }

  return (
    <section>
      <h2>Cases</h2>
      <div className="metrics">
        <article>
          <span>In this queue</span>
          <strong>{cases.length}</strong>
        </article>
        {statuses.map((item) => (
          <article key={item}>
            <span>{item.replaceAll('_', ' ')}</span>
            <strong>{cases.filter((entry) => entry.status === item).length}</strong>
          </article>
        ))}
      </div>
      <div className="filters">
        <label>
          Search
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, type, or status" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? <p className="notice">No cases match this view.</p> : null}
      {shown.map((item) => {
        const stage = STAGE_FOR[item.status];
        const allowed = stage ? roles.includes(stage === 'authorised_approver' ? 'authorised_approver' : stage) : false;
        return (
          <article key={item.id}>
            <h3>
              {item.customer.legalName} · {item.status.replaceAll('_', ' ')}
            </h3>
            {allowed ? (
              <form onSubmit={(event) => decide(event, item)}>
                <label>
                  Reason
                  <input name="reason" required />
                </label>
                <div className="actions">
                  <button type="submit" value="accept">
                    Accept
                  </button>
                  <button className="secondary" type="submit" value="return">
                    Return
                  </button>
                </div>
              </form>
            ) : null}
          </article>
        );
      })}
      {error ? <p className="notice error">{error}</p> : null}
      {message ? <p className="notice success">{message}</p> : null}
    </section>
  );
}
