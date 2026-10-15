export class ApiOriginError extends Error {
  readonly reason: 'missing' | 'malformed';

  constructor(reason: 'missing' | 'malformed') {
    super(reason === 'missing' ? 'API origin is not configured' : 'API origin is malformed');
    this.name = 'ApiOriginError';
    this.reason = reason;
  }
}

export function readApiOrigin(value: string | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new ApiOriginError('missing');
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ApiOriginError('malformed');
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new ApiOriginError('malformed');
  }
  return url.toString().replace(/\/$/, '');
}

export function logApiOriginError(error: unknown): void {
  if (error instanceof ApiOriginError) {
    console.error(error.message);
  }
}
