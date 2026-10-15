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
        <p>Set a password of at least 10 characters to open the customer onboarding draft.</p>
        {params.token ? <AcceptForm token={params.token} /> : <p className="notice error">This invitation link is incomplete.</p>}
      </section>
    </main>
  );
}
