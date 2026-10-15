import { ShareAccept } from './share-accept';

export default async function SharePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return (
    <main className="gate">
      <section className="card">
        <p className="brand">MYKA</p>
        <h1>Shared company KYC</h1>
        <p>This link opens only the fields and files that were selected. It expires and can be revoked.</p>
        {params.token ? <ShareAccept token={params.token} /> : <p className="notice error">This share link is incomplete.</p>}
      </section>
    </main>
  );
}
