export const DEMO_MFA_ACCOUNTS = [
  'customer-phase5@example.com',
  'maker-phase5@example.com',
  'checker-phase5@example.com',
  'approver-phase5@example.com',
  'admin-phase5@example.com',
];

export function localDevelopmentTarget(env) {
  if (env.NODE_ENV === 'production') {
    return false;
  }
  let url;
  try {
    url = new URL(env.DATABASE_URL ?? '');
  } catch {
    return false;
  }
  const localHost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  return localHost && url.port === '54329' && url.pathname === '/myka';
}

export function selectedDemoAccount(email) {
  return DEMO_MFA_ACCOUNTS.includes(email) ? email : null;
}

export function selectedRecoveryAccount(email, roles = []) {
  if (typeof email !== 'string' || email.length === 0) {
    return null;
  }
  if (DEMO_MFA_ACCOUNTS.includes(email)) {
    return email;
  }
  if (Array.isArray(roles) && roles.includes('employee')) {
    return email;
  }
  return null;
}
