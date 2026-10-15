import assert from 'node:assert/strict';
import test from 'node:test';
import { readApiOrigin } from './api-origin.ts';

test('rejects a missing API origin', () => {
  assert.throws(() => readApiOrigin(undefined), { message: 'API origin is not configured' });
  assert.throws(() => readApiOrigin('   '), { message: 'API origin is not configured' });
});

test('rejects a relative path', () => {
  assert.throws(() => readApiOrigin('/api'), { message: 'API origin is malformed' });
});

test('accepts an https origin and strips one trailing slash', () => {
  assert.equal(readApiOrigin('https://api.example.com/'), 'https://api.example.com');
  assert.equal(readApiOrigin('https://api.example.com/internal/'), 'https://api.example.com/internal');
});
