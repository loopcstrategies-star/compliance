import { LoginForm } from './login-form';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  return (
    <main>
      <h1>Sign in</h1>
      <p>Use the account issued for your organisation.</p>
      {params.denied ? <p className="notice">That area is not available for this role.</p> : null}
      <LoginForm />
    </main>
  );
}
