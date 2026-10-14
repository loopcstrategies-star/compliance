'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
  const [code, setCode] = useState('');
  const [retryAfter, setRetryAfter] = useState(0);
  const [setupUri, setSetupUri] = useState('');
  const [qr, setQr] = useState('');
  const submitting = useRef(false);

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

  useEffect(() => {
    if (retryAfter <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRetryAfter((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = code.trim();
    if (!/^\d{6}$/.test(normalized) || submitting.current || retryAfter > 0) {
      return;
    }
    submitting.current = true;
    setPending(true);
    setError('');
    const response = await fetch('/api/auth/mfa', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: normalized }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[];
        retryAfterSeconds?: number;
      } | null;
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      setRetryAfter(typeof body?.retryAfterSeconds === 'number' ? body.retryAfterSeconds : 0);
      submitting.current = false;
      setPending(false);
      setError(message || 'That code was not accepted.');
      return;
    }
    const meResponse = await fetch('/api/auth/me');
    if (!meResponse.ok) {
      submitting.current = false;
      setPending(false);
      setError('The session was not stored.');
      return;
    }
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
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          required
        />
      </label>
      {error ? <p className="notice error">{error}</p> : null}
      {retryAfter > 0 ? <p>Try again in {retryAfter} seconds.</p> : null}
      <button type="submit" disabled={pending || retryAfter > 0 || code.length !== 6}>Continue</button>
    </form>
  );
}
