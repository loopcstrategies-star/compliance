import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSectionSaveQueue,
  resolveSaveUiState,
  shouldApplySaveResult,
  type SectionSaveRequest,
} from './section-save-queue.ts';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('serialized queue runs saves one at a time and coalesces pending payloads', async () => {
  const started: string[] = [];
  const finished: string[] = [];
  const queue = createSectionSaveQueue(async (request) => {
    started.push(String(request.answers.value));
    await wait(30);
    finished.push(String(request.answers.value));
    return { ok: true };
  });

  const first = queue.enqueue({ sectionKey: 'kyc.entity', answers: { value: 'a' }, markComplete: false });
  const second = queue.enqueue({ sectionKey: 'kyc.entity', answers: { value: 'b' }, markComplete: false });
  const third = queue.enqueue({ sectionKey: 'kyc.entity', answers: { value: 'c' }, markComplete: false });

  const results = await Promise.all([first, second, third]);
  await queue.drain();

  assert.equal(started.length, 2);
  assert.deepEqual(started, ['a', 'c']);
  assert.deepEqual(finished, ['a', 'c']);
  assert.equal(results[0]?.ok, true);
  assert.equal(results[1]?.superseded, true);
  assert.equal(results[2]?.ok, true);
  assert.equal(queue.isBusy(), false);
});

test('later save preserves newer values when initiated rapidly', async () => {
  const written: SectionSaveRequest[] = [];
  const queue = createSectionSaveQueue(async (request) => {
    written.push(request);
    await wait(10);
    return { ok: true };
  });

  void queue.enqueue({ sectionKey: 'kyc.entity', answers: { name: 'old' }, markComplete: false });
  void queue.enqueue({ sectionKey: 'kyc.entity', answers: { name: 'mid' }, markComplete: false });
  const latest = queue.enqueue({ sectionKey: 'kyc.entity', answers: { name: 'newest' }, markComplete: false });
  const result = await latest;
  await queue.drain();

  assert.equal(result.ok, true);
  assert.equal(written.at(-1)?.answers.name, 'newest');
});

test('failed save does not resolve as saved UI state for the current generation', () => {
  assert.equal(shouldApplySaveResult(3, 3), true);
  assert.equal(shouldApplySaveResult(2, 3), false);
  assert.equal(
    resolveSaveUiState({ generation: 2, currentGeneration: 3, ok: true, busy: true }),
    'saving',
  );
  assert.equal(
    resolveSaveUiState({ generation: 3, currentGeneration: 3, ok: false, busy: false }),
    'error',
  );
  assert.equal(
    resolveSaveUiState({ generation: 3, currentGeneration: 3, ok: true, busy: false }),
    'saved',
  );
  assert.notEqual(
    resolveSaveUiState({ generation: 3, currentGeneration: 3, ok: false, busy: false }),
    'saved',
  );
});

test('runner exceptions become failed results without throwing to callers', async () => {
  const queue = createSectionSaveQueue(async () => {
    throw new Error('network down');
  });
  const result = await queue.enqueue({ sectionKey: 'kyc.entity', answers: { name: 'x' }, markComplete: false });
  assert.equal(result.ok, false);
  assert.equal(queue.isBusy(), false);
});
test('saves for different sections are not dropped', async () => {
  const started: string[] = [];
  let releaseFirst!: () => void;

  const firstSaveBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const queue = createSectionSaveQueue(async (request) => {
    started.push(`${request.sectionKey}:${String(request.answers.value)}`);

    if (request.answers.value === 'first') {
      await firstSaveBlocked;
    }

    return { ok: true };
  });

  const first = queue.enqueue({
    sectionKey: 'section-a',
    answers: { value: 'first' },
    markComplete: false,
  });

  await Promise.resolve();
  await Promise.resolve();

  const second = queue.enqueue({
    sectionKey: 'section-b',
    answers: { value: 'second' },
    markComplete: false,
  });

  const third = queue.enqueue({
    sectionKey: 'section-c',
    answers: { value: 'third' },
    markComplete: false,
  });

  releaseFirst();

  const results = await Promise.all([first, second, third]);
  await queue.drain();

  assert.deepEqual(started, [
    'section-a:first',
    'section-b:second',
    'section-c:third',
  ]);
  assert.ok(results.every((result) => result.ok));
});
