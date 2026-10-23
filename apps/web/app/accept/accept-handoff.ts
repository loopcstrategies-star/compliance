import type { OpenResult } from './open-invitation';

export type AcceptHandoff =
  | { kind: 'error'; error: string; keepLocked: false }
  | { kind: 'success'; keepLocked: true; href: '/portal' };

/** After openInvitation resolves, decide lock + navigation. Success stays locked. */
export function planAcceptHandoff(result: OpenResult): AcceptHandoff {
  if (!result.redirect) {
    return { kind: 'error', error: result.error, keepLocked: false };
  }
  return { kind: 'success', keepLocked: true, href: '/portal' };
}
