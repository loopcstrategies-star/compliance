import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logApiOriginError, readApiOrigin } from './api-origin';

export type Me = {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  roles: string[];
  mfaSatisfied: boolean;
  privileged: boolean;
};

export async function loadMe(): Promise<Me | null> {
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
    throw new Error('The service is temporarily unavailable.');
  }
  try {
    const response = await fetch(`${origin}/auth/me`, {
      headers: { cookie: `myka_session=${session}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return null;
    }
    return response.json() as Promise<Me>;
  } catch {
    console.error('API request failed');
    throw new Error('The service is temporarily unavailable.');
  }
}

export async function requireArea(allowed: string[]): Promise<Me> {
  const me = await loadMe();
  if (!me) {
    redirect('/login');
  }
  if (me.privileged && !me.mfaSatisfied) {
    redirect('/mfa');
  }
  if (!me.roles.some((role) => allowed.includes(role))) {
    redirect('/login?denied=1');
  }
  return me;
}
