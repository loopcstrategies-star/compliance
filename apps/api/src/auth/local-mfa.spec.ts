import { assertMfaDeferralConfiguration, localMfaDeferralAllowed } from './local-mfa';

const local = {
  NODE_ENV: 'development',
  LOCAL_MFA_DEFER: 'true',
  DATABASE_URL: 'postgresql://local:secret@localhost:54329/myka',
};

describe('local MFA deferral', () => {
  it('allows deferral only for the local development database', () => {
    expect(localMfaDeferralAllowed(local)).toBe(true);
    expect(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@127.0.0.1:54329/myka' })).toBe(true);
  });

  it('rejects a false or absent flag', () => {
    expect(localMfaDeferralAllowed({ ...local, LOCAL_MFA_DEFER: 'false' })).toBe(false);
    const { LOCAL_MFA_DEFER: _flag, ...withoutFlag } = local;
    expect(localMfaDeferralAllowed(withoutFlag)).toBe(false);
  });

  it('rejects a remote host, another database, or another port', () => {
    expect(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@example.com:54329/myka' })).toBe(false);
    expect(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@localhost:54329/other' })).toBe(false);
    expect(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@localhost:5432/myka' })).toBe(false);
  });

  it('rejects production startup when the flag is set', () => {
    expect(localMfaDeferralAllowed({ ...local, NODE_ENV: 'production' })).toBe(false);
    expect(() => assertMfaDeferralConfiguration(local)).not.toThrow();
    expect(() => assertMfaDeferralConfiguration({ NODE_ENV: 'production', LOCAL_MFA_DEFER: 'true' })).toThrow(
      'LOCAL_MFA_DEFER cannot be enabled when NODE_ENV is production.',
    );
  });
});
