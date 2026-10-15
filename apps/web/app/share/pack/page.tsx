import { cookies } from 'next/headers';
import { readApiOrigin } from '../../../lib/api-origin';

type Pack = {
  recipientName: string;
  expiresAt: string;
  answers: { fieldKey: string; value: unknown }[];
  evidence: { id: string; documentType: string; fileId: string; expiresOn: string | null }[];
};

export default async function SharedPackPage() {
  const jar = await cookies();
  const access = jar.get('myka_share')?.value;
  if (!access) {
    return (
      <main className="gate">
        <section className="card">
          <p className="notice error">Open the share link before viewing this pack.</p>
        </section>
      </main>
    );
  }
  let pack: Pack | null = null;
  try {
    const response = await fetch(`${readApiOrigin(process.env.API_INTERNAL_URL)}/company-kyc/current`, {
      headers: { cookie: `myka_share=${access}` },
      cache: 'no-store',
    });
    if (response.ok) {
      pack = (await response.json()) as Pack;
    }
  } catch {
    pack = null;
  }
  return (
    <main className="gate">
      <section className="card">
        <h1>Shared pack</h1>
        {pack ? (
          <>
            <p>
              For {pack.recipientName}. Access until {new Date(pack.expiresAt).toLocaleString()}.
            </p>
            <ul>
              {pack.answers.map((answer) => (
                <li key={answer.fieldKey}>
                  {answer.fieldKey}: {typeof answer.value === 'string' ? answer.value : JSON.stringify(answer.value)}
                </li>
              ))}
            </ul>
            <ul>
              {pack.evidence.map((item) => (
                <li key={item.id}>
                  {item.documentType} · <a href={`/api/company-kyc/files/${item.fileId}`}>Download</a>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="notice error">This share is expired, revoked, or unavailable.</p>
        )}
      </section>
    </main>
  );
}
