'use client';

export function SignOut() {
  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <button className="secondary" type="button" onClick={signOut}>
      Sign out
    </button>
  );
}
