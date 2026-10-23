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
    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: form.get('name') }),
      });
      if (!response.ok) {
        const message = await readMessage(response);
        setError(message ?? 'The company was not created.');
        return;
      }
      const body = (await response.json()) as { id?: unknown; name?: unknown };
      const id = typeof body.id === 'string' ? body.id.trim() : '';
      if (!id) {
        setError('The company was created, but its identifier was missing. Refresh and select it from the list.');
        return;
      }
      router.push(`/workspace/company/onboarding?tenant=${encodeURIComponent(id)}&created=1`);
    } catch {
      setError('The company could not be created. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="company-create-form">
      <label>
        Company name
        <input name="name" required autoComplete="organization" placeholder="Enter company name" />
      </label>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create company'}
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
