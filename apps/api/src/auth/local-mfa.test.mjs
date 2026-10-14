import assert from 'node:assert/strict';
import test from 'node:test';
import { assertMfaDeferralConfiguration, localMfaDeferralAllowed } from './local-mfa.ts';

const local = {
  NODE_ENV: 'development',
  LOCAL_MFA_DEFER: 'true',
  DATABASE_URL: 'postgresql://local:secret@localhost:54329/myka',
};

test('local MFA deferral is limited to the local development database', () => {
  assert.equal(localMfaDeferralAllowed(local), true);
  assert.equal(localMfaDeferralAllowed({ ...local, LOCAL_MFA_DEFER: 'false' }), false);
  assert.equal(localMfaDeferralAllowed({ ...local, NODE_ENV: 'production' }), false);
  assert.equal(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@localhost:54329/other' }), false);
  assert.equal(localMfaDeferralAllowed({ ...local, DATABASE_URL: 'postgresql://local:secret@example.com:54329/myka' }), false);
});

test('production startup rejects a configuration that would disable MFA', () => {
  assert.doesNotThrow(() => assertMfaDeferralConfiguration(local));
  assert.throws(
    () => assertMfaDeferralConfiguration({ NODE_ENV: 'production', LOCAL_MFA_DEFER: 'true' }),
    /LOCAL_MFA_DEFER cannot be enabled/,
  );
});
