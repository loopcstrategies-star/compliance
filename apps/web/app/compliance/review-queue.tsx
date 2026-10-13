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
  maker_review: 'checker',
  checker_review: 'authorised_approver',
};

export function ReviewQueue({ cases, roles }: { cases: ReviewCase[]; roles: string[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      {cases.length === 0 ? <p className="notice">No cases are waiting in this tenant.</p> : null}
      {cases.map((item) => {
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
                <button type="submit" value="accept">
                  Accept
                </button>
                <button type="submit" value="return">
                  Return
                </button>
              </form>
            ) : null}
          </article>
        );
      })}
      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
    </section>
  );
}
