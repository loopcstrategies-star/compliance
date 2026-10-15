import { NextRequest } from 'next/server';
import { ApiOriginError, logApiOriginError, readApiOrigin } from '../../../lib/api-origin';

function unavailable(): Response {
  return Response.json({ message: 'The service is temporarily unavailable.' }, { status: 503 });
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  let origin: string;
  try {
    origin = readApiOrigin(process.env.API_INTERNAL_URL);
  } catch (error) {
    logApiOriginError(error);
    if (error instanceof ApiOriginError) {
      return unavailable();
    }
    throw error;
  }
  const target = new URL(`${origin}/${path.join('/')}`);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete('host');
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? Buffer.from(await request.arrayBuffer()) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    console.error('API request failed');
    return unavailable();
  }
  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(key, value);
    }
  });
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append('set-cookie', cookie);
  }
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: responseHeaders,
  });
}

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, context: Context) {
  const { path } = await context.params;
  return proxy(request, path);
}
