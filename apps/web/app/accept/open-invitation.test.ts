import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SIGN_OUT_REQUIRED, UNAVAILABLE, USED_LINK, openInvitation } from './open-invitation.ts';

test('a successful accept redirects to the portal handoff', async () => {
  const result = await openInvitation('invite-token', async () => jsonResponse(201, { userId: 'u1', tenantId: 't1' }));
  assert.equal(result.pending, false);
  assert.equal(result.redirect, true);
  assert.equal(result.error, '');
});

test('a network failure leaves the accept action no longer pending', async () => {
  const result = await openInvitation('invite-token', async () => {
    throw new Error('network down');
  });
  assert.equal(result.pending, false);
  assert.equal(result.redirect, false);
  assert.equal(result.error, UNAVAILABLE);
  assert.equal(result.error.includes('invite-token'), false);
});

test('a signed-in wrong account and a used link stay on the accept page', async () => {
  const wrongAccount = await openInvitation('invite-token', async () =>
    jsonResponse(403, { message: SIGN_OUT_REQUIRED }),
  );
  assert.equal(wrongAccount.pending, false);
  assert.equal(wrongAccount.redirect, false);
  assert.equal(wrongAccount.error, SIGN_OUT_REQUIRED);

  const used = await openInvitation('invite-token', async () => jsonResponse(400, { message: 'Invitation is not valid' }));
  assert.equal(used.pending, false);
  assert.equal(used.redirect, false);
  assert.equal(used.error, USED_LINK);
  assert.equal(used.error.includes('invite-token'), false);
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
