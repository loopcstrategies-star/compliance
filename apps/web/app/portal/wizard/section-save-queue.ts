
/**
 * Serializes async section saves so only one request runs at a time.
 * Pending saves are coalesced only when they belong to the same section.
 * Saves for different sections are preserved in queue order.
 */

export type SectionSaveRequest = {
  sectionKey: string;
  answers: Record<string, unknown>;
  markComplete: boolean;
};

export type SectionSaveResult = {
  ok: boolean;
  /** True when this enqueue was replaced before it ran. */
  superseded?: boolean;
};

export type SectionSaveRunner = (
  request: SectionSaveRequest,
) => Promise<SectionSaveResult>;

export type SectionSaveQueue = {
  enqueue: (request: SectionSaveRequest) => Promise<SectionSaveResult>;
  drain: () => Promise<void>;
  isBusy: () => boolean;
};

type Job = {
  request: SectionSaveRequest;
  resolvers: Array<(result: SectionSaveResult) => void>;
};

export function createSectionSaveQueue(run: SectionSaveRunner): SectionSaveQueue {
  let active: Promise<void> | null = null;
  const pending: Job[] = [];
  let idleWaiters: Array<() => void> = [];

  function notifyIdle() {
    if (active || pending.length > 0) return;

    const waiters = idleWaiters;
    idleWaiters = [];

    for (const resolve of waiters) resolve();
  }

  function enqueue(request: SectionSaveRequest): Promise<SectionSaveResult> {
    return new Promise<SectionSaveResult>((resolve) => {
      // Replace only an older pending save for the same section.
      const existingIndex = pending.findIndex(
        (job) => job.request.sectionKey === request.sectionKey,
      );

      if (existingIndex !== -1) {
        const [previous] = pending.splice(existingIndex, 1);

        for (const previousResolve of previous.resolvers) {
          previousResolve({ ok: true, superseded: true });
        }
      }

      // Keep saves for different sections in queue order.
      pending.push({ request, resolvers: [resolve] });
      void pump();
    });
  }

  async function pump(): Promise<void> {
    if (active) return;

    while (pending.length > 0) {
      const job = pending.shift()!;
      let result: SectionSaveResult = { ok: false };

      active = (async () => {
        try {
          result = await run(job.request);
        } catch {
          result = { ok: false };
        }
      })();

      await active;
      active = null;

      for (const resolve of job.resolvers) resolve(result);
    }

    notifyIdle();
  }

  function drain(): Promise<void> {
    if (!active && pending.length === 0) return Promise.resolve();

    return new Promise<void>((resolve) => {
      idleWaiters.push(resolve);
    });
  }

  function isBusy(): boolean {
    return active !== null || pending.length > 0;
  }

  return { enqueue, drain, isBusy };
}

/** Only the latest generation may apply success/error UI. */
export function shouldApplySaveResult(
  generation: number,
  currentGeneration: number,
): boolean {
  return generation === currentGeneration;
}

/**
 * Derive the save indicator state.
 * Never reports "saved" while a newer generation is pending or busy.
 */
export function resolveSaveUiState(input: {
  generation: number;
  currentGeneration: number;
  ok: boolean;
  busy: boolean;
}): 'saved' | 'error' | 'saving' | 'unchanged' {
  if (input.generation !== input.currentGeneration) {
    return input.busy ? 'saving' : 'unchanged';
  }

  if (!input.ok) return 'error';

  return input.busy ? 'saving' : 'saved';
}
