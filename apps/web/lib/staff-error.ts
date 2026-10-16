export async function staffFailure(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) {
    return 'The session has expired.';
  }
  if (response.status === 403) {
    return 'Permission denied.';
  }
  if (response.status === 404) {
    return 'No invitation was found for that email.';
  }
  if (response.status === 429) {
    return 'Wait before issuing another link.';
  }
  if (response.status >= 500) {
    return fallback;
  }
  if (response.status === 400) {
    return (await readMessage(response)) ?? 'The request was rejected.';
  }
  return fallback;
}

async function readMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { message?: unknown };
    const message = Array.isArray(body.message) ? body.message[0] : body.message;
    if (typeof message !== 'string') {
      return null;
    }
    const text = message.trim();
    if (!text || text.length > 200 || /[\r\n]/.test(text) || text.includes('Exception')) {
      return null;
    }
    return text;
  } catch {
    return null;
  }
}
