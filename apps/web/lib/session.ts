import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

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
  const response = await fetch(`${process.env.API_INTERNAL_URL}/auth/me`, {
    headers: { cookie: `myka_session=${session}` },
    cache: 'no-store',
  });
  if (!response.ok) {
    return null;
  }
  return response.json() as Promise<Me>;
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
