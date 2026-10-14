export function localMfaDeferralAllowed(env: NodeJS.ProcessEnv): boolean {
  if (env.LOCAL_MFA_DEFER !== 'true' || env.NODE_ENV === 'production') {
    return false;
  }
  let url: URL;
  try {
    url = new URL(env.DATABASE_URL ?? '');
  } catch {
    return false;
  }
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return localHost && url.port === '54329' && url.pathname === '/myka';
}

export function assertMfaDeferralConfiguration(env: NodeJS.ProcessEnv): void {
  if (env.NODE_ENV === 'production' && env.LOCAL_MFA_DEFER === 'true') {
    throw new Error('LOCAL_MFA_DEFER cannot be enabled when NODE_ENV is production.');
  }
}
