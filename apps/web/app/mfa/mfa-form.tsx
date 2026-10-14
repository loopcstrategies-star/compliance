'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';

const HOME: Record<string, string> = {
  employee: '/employee',
  maker: '/compliance',
  checker: '/compliance',
  authorised_approver: '/compliance',
  super_admin: '/admin',
};

export function MfaForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [setupUri, setSetupUri] = useState('');
  const [qr, setQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/auth/mfa/setup');
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { otpauthUri?: string };
      if (!body.otpauthUri || cancelled) {
        return;
      }
      setSetupUri(body.otpauthUri);
      const image = await QRCode.toDataURL(body.otpauthUri, { margin: 1, width: 180 });
      if (!cancelled) {
        setQr(image);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: form.get('code') }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      setPending(false);
      setError(message || 'That code was not accepted.');
      return;
    }
    const meResponse = await fetch('/api/auth/me');
    const me = await meResponse.json();
    router.push(HOME[me.roles[0]] ?? '/login');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      {qr ? (
        <section>
          <p>Scan this code with your authenticator, then enter the 6-digit code it shows.</p>
          <img src={qr} alt="Authenticator setup code" width={180} height={180} />
          <label>
            Setup link
            <input readOnly value={setupUri} />
          </label>
        </section>
      ) : null}
      <p>Enter the current 6-digit code. A code from the previous or next 30 seconds is also accepted.</p>
      <label>
        Code
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
        />
      </label>
      {error ? <p className="notice">{error}</p> : null}
      <button type="submit" disabled={pending}>Continue</button>
    </form>
  );
}
