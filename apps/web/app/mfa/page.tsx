import { redirect } from 'next/navigation';
import { loadMe } from '../../lib/session';
import { MfaForm } from './mfa-form';

export default async function MfaPage() {
  const me = await loadMe();
  if (!me) {
    redirect('/login');
  }
  if (!me.privileged || me.mfaSatisfied) {
    redirect('/login');
  }
  return (
    <main className="gate">
      <section className="card">
        <p className="brand">LoopC</p>
        <h1>Verification code</h1>
        <p>Enter the code from your authenticator for {me.email}.</p>
        <MfaForm />
      </section>
    </main>
  );
}
