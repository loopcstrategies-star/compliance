'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateCompanyForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.get('name') }),
    });
    setPending(false);
    if (!response.ok) {
      const message = await readMessage(response);
      setError(message ?? 'The company was not created.');
      return;
    }
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <h2>Create onboarding company</h2>
      <p className="notice">Customer invitations use this company. The Platform tenant cannot receive applicants.</p>
      <label>
        Company name
        <input name="name" required />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Creating' : 'Create company'}
      </button>
    </form>
  );
}

async function readMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof message !== 'string') {
      return null;
    }
    const text = message.trim();
    if (!text || text.length > 200 || /[\r\n]/.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
