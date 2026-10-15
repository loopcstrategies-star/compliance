import { cookies } from 'next/headers';
import { logApiOriginError, readApiOrigin } from './api-origin';

export async function apiGet<T>(path: string): Promise<T | null> {
  const jar = await cookies();
  const session = jar.get('myka_session')?.value;
  if (!session) {
    return null;
  }
  let origin: string;
  try {
    origin = readApiOrigin(process.env.API_INTERNAL_URL);
  } catch (error) {
    logApiOriginError(error);
    return null;
  }
  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { cookie: `myka_session=${session}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return null;
    }
    return response.json() as Promise<T>;
  } catch {
    console.error('API request failed');
    return null;
  }
}
