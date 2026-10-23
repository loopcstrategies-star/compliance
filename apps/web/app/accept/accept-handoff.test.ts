import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planAcceptHandoff } from './accept-handoff.ts';
import { SIGN_OUT_REQUIRED, UNAVAILABLE, USED_LINK } from './open-invitation.ts';

test('successful accept stays locked and navigates to portal', () => {
  const handoff = planAcceptHandoff({ pending: false, error: '', redirect: true });
  assert.equal(handoff.kind, 'success');
  if (handoff.kind !== 'success') {
    return;
  }
  assert.equal(handoff.keepLocked, true);
  assert.equal(handoff.href, '/portal');
});

test('failed accept unlocks so the user can retry when appropriate', () => {
  const used = planAcceptHandoff({ pending: false, error: USED_LINK, redirect: false });
  assert.equal(used.kind, 'error');
  if (used.kind !== 'error') {
    return;
  }
  assert.equal(used.keepLocked, false);
  assert.equal(used.error, USED_LINK);

  const wrongRole = planAcceptHandoff({ pending: false, error: SIGN_OUT_REQUIRED, redirect: false });
  assert.equal(wrongRole.kind, 'error');
  if (wrongRole.kind === 'error') {
    assert.equal(wrongRole.keepLocked, false);
  }

  const network = planAcceptHandoff({ pending: false, error: UNAVAILABLE, redirect: false });
  assert.equal(network.kind, 'error');
  if (network.kind === 'error') {
    assert.equal(network.keepLocked, false);
  }
});
