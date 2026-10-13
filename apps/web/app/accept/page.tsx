import { AcceptForm } from './accept-form';

export default async function AcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <main>
      <h1>Accept invitation</h1>
      <p>Set a password to open the customer onboarding draft.</p>
      {params.token ? <AcceptForm token={params.token} /> : <p className="notice">This invitation link is incomplete.</p>}
    </main>
  );
}
