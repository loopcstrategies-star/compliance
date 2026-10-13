import { redact } from './redact';

describe('redact', () => {
  it('removes passwords, raw tokens, and MFA secrets', () => {
    const cleaned = redact({
      email: 'a@b.c',
      password: 'hunter2',
      passwordHash: 'hash',
      nested: {
        mfaSecret: 'totp',
        sessionToken: 'raw-session',
        cookie: 'myka_session=abc',
      },
      authorization: 'Bearer raw',
    });
    expect(cleaned.email).toBe('a@b.c');
    expect(cleaned.password).toBe('[redacted]');
    expect(cleaned.passwordHash).toBe('[redacted]');
    expect(cleaned.nested.mfaSecret).toBe('[redacted]');
    expect(cleaned.nested.sessionToken).toBe('[redacted]');
    expect(cleaned.nested.cookie).toBe('[redacted]');
    expect(cleaned.authorization).toBe('[redacted]');
    expect(JSON.stringify(cleaned)).not.toContain('hunter2');
    expect(JSON.stringify(cleaned)).not.toContain('raw-session');
    expect(JSON.stringify(cleaned)).not.toContain('totp');
  });
});
