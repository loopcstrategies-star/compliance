export const SIGN_OUT_REQUIRED =
  'Sign out, or open this link in a private browser window, before opening the application.';
export const USED_LINK = 'This invitation cannot be used.';
export const UNAVAILABLE = 'The service is temporarily unavailable.';

export type OpenResult = { pending: false; error: string; redirect: boolean };

export async function openInvitation(token: string, fetchImpl: typeof fetch = fetch): Promise<OpenResult> {
  try {
    const response = await fetchImpl('/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      return { pending: false, error: '', redirect: true };
    }
    if (response.status === 403) {
      const message = await readSafeMessage(response);
      if (message === SIGN_OUT_REQUIRED) {
        return { pending: false, error: SIGN_OUT_REQUIRED, redirect: false };
      }
    }
    if (response.status >= 500) {
      return { pending: false, error: UNAVAILABLE, redirect: false };
    }
    return { pending: false, error: USED_LINK, redirect: false };
  } catch {
    return { pending: false, error: UNAVAILABLE, redirect: false };
  }
}

async function readSafeMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof message !== 'string') {
      return null;
    }
    const text = message.trim();
    if (!text || text.length > 200 || /[\r\n]/.test(text)) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
