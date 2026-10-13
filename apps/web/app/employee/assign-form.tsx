'use client';

import { FormEvent, useState } from 'react';

type CaseRow = { id: string; status: string; legalName: string; assigneeId: string | null };
type Person = { id: string; displayName: string; email: string };

export function AssignForm({ cases, users }: { cases: CaseRow[]; users: Person[] }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const applicationId = String(form.get('applicationId'));
    const response = await fetch(`/api/applications/${applicationId}/assignment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assigneeId: form.get('assigneeId') }),
    });
    if (!response.ok) {
      setError('That person cannot take this stage.');
      return;
    }
    setMessage('Assignment saved.');
  }

  if (cases.length === 0) {
    return null;
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Assignment</h2>
      <label>
        Case
        <select name="applicationId" required defaultValue={cases[0]?.id ?? ''}>
          {cases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.legalName} · {item.status.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Person
        <select name="assigneeId" required defaultValue={users[0]?.id ?? ''}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="notice">{error}</p> : null}
      {message ? <p className="notice">{message}</p> : null}
      <button type="submit">Assign</button>
    </form>
  );
}
