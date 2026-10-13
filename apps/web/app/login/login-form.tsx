'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

const HOME: Record<string, string> = {
  customer: '/portal',
  employee: '/employee',
  maker: '/compliance',
  checker: '/compliance',
  authorised_approver: '/compliance',
  super_admin: '/admin',
};

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    if (!response.ok) {
      setError('Those details were not accepted.');
      return;
    }
    const meResponse = await fetch('/api/auth/me');
    if (!meResponse.ok) {
      setError('The session was not stored.');
      return;
    }
    const me = await meResponse.json();
    if (me.privileged && !me.mfaSatisfied) {
      router.push('/mfa');
      return;
    }
    router.push(HOME[me.roles[0]] ?? '/login');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Email
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="notice">{error}</p> : null}
      <button type="submit">Sign in</button>
    </form>
  );
}
