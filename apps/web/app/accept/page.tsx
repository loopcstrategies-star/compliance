import { AcceptForm } from './accept-form';

export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="gate">
      <section className="card">
        <p className="brand">MYKA</p>
        <h1>Accept invitation</h1>
        <p>This link opens your onboarding draft. It can be used once.</p>
        {params.token ? <AcceptForm token={params.token} /> : <p className="notice error">This invitation link is incomplete.</p>}
      </section>
    </main>
  );
}
