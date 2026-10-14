import assert from 'node:assert/strict';
import test from 'node:test';
import { localDevelopmentTarget, selectedDemoAccount, selectedRecoveryAccount } from './demo-mfa.mjs';

test('MFA recovery accepts only the local development database', () => {
  const local = { NODE_ENV: 'development', DATABASE_URL: 'postgresql://local:secret@localhost:54329/myka' };
  assert.equal(localDevelopmentTarget(local), true);
  assert.equal(localDevelopmentTarget({ ...local, NODE_ENV: 'production' }), false);
  assert.equal(localDevelopmentTarget({ ...local, DATABASE_URL: 'postgresql://local:secret@127.0.0.1:54329/other' }), false);
});

test('MFA recovery accepts only a named demo account', () => {
  assert.equal(selectedDemoAccount('maker-phase5@example.com'), 'maker-phase5@example.com');
  assert.equal(selectedDemoAccount('other@example.com'), null);
  assert.equal(selectedDemoAccount(undefined), null);
});

test('MFA recovery also accepts an explicitly named employee', () => {
  assert.equal(selectedRecoveryAccount('maker-phase5@example.com', ['maker']), 'maker-phase5@example.com');
  assert.equal(selectedRecoveryAccount('mfa-d@example.com', ['employee']), 'mfa-d@example.com');
  assert.equal(selectedRecoveryAccount('mfa-a@example.com', ['maker']), null);
  assert.equal(selectedRecoveryAccount('other@example.com', ['customer']), null);
  assert.equal(selectedRecoveryAccount(undefined, ['employee']), null);
});
