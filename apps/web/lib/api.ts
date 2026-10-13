import { cookies } from 'next/headers';

export async function apiGet<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const session = jar.get('myka_session')?.value;
  if (!session) {
    return null;
  }
  const response = await fetch(`${process.env.API_INTERNAL_URL}${path}`, {
    headers: { cookie: `myka_session=${session}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<T>;
}
