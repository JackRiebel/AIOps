// API Proxy Route - forwards all /api/* requests to backend on port 8000
// This solves the "Failed to fetch" error by eliminating cross-origin requests

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'https://localhost:8002';

// Allow self-signed certificates for local development
// This is needed because the backend uses a self-signed SSL cert
if (BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path, 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path, 'DELETE');
}

export async function OPTIONS(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  return proxyRequest(request, params.path, 'OPTIONS');
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  method: string
) {
  try {
    // Build the backend URL
    const backendPath = `/api/${path.join('/')}`;
    const searchParams = request.nextUrl.searchParams.toString();
    const backendUrl = `${BACKEND_URL}${backendPath}${searchParams ? `?${searchParams}` : ''}`;

    console.log(`[API Proxy] ${method} ${backendUrl}`);

    // Check Content-Type to determine how to handle body
    const incomingContentType = request.headers.get('Content-Type') || '';
    const isMultipart = incomingContentType.includes('multipart/form-data');
    const isFormUrlEncoded = incomingContentType.includes('application/x-www-form-urlencoded');

    // Get request body for POST/PUT
    let body: string | ArrayBuffer | undefined;
    if (method === 'POST' || method === 'PUT') {
      try {
        if (isMultipart || isFormUrlEncoded) {
          // For form data, pass the raw body (arrayBuffer preserves binary data)
          body = await request.arrayBuffer();
        } else {
          body = await request.text();
        }
      } catch (e) {
        // No body
      }
    }

    // Forward cookies from browser to backend
    const cookie = request.headers.get('Cookie');
    console.log(`[API Proxy] Cookie header: ${cookie ? `found (${cookie.slice(0, 50)}...)` : 'MISSING'}`);

    // Check if client is requesting SSE stream
    const acceptHeader = request.headers.get('Accept');
    const isStreamRequest = acceptHeader?.includes('text/event-stream');

    // Build headers - preserve original Content-Type for form data
    const requestHeaders: HeadersInit = {
      'Accept': isStreamRequest ? 'text/event-stream' : 'application/json',
    };

    // Forward Content-Type - use original for form data, default to JSON for others
    if (isMultipart || isFormUrlEncoded) {
      requestHeaders['Content-Type'] = incomingContentType;
    } else if (body) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (cookie) {
      requestHeaders['Cookie'] = cookie;
    }

    // Forward the request to backend
    // Use redirect: 'manual' to capture redirects and forward them properly
    const response = await fetch(backendUrl, {
      method,
      headers: requestHeaders,
      body,
      redirect: 'manual',
    });

    // Check if response is SSE stream
    const contentType = response.headers.get('Content-Type');
    const isStreamResponse = contentType?.includes('text/event-stream');

    if (isStreamResponse && response.body) {
      // Stream the response directly without buffering
      console.log(`[API Proxy] Streaming SSE response for ${backendUrl}`);

      // Forward Set-Cookie headers from backend for SSE too
      const responseHeaders: HeadersInit = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      };

      const setCookie = response.headers.get('Set-Cookie');
      if (setCookie) {
        responseHeaders['Set-Cookie'] = setCookie;
      }

      return new NextResponse(response.body, {
        status: response.status,
        headers: responseHeaders,
      });
    }

    // Handle redirect responses (e.g., OAuth redirects to Google, OAuth callback)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        console.log(`[API Proxy] Redirect ${response.status} to: ${location}`);

        // Use NextResponse.redirect() for proper redirect handling, then
        // explicitly set cookies via the cookies API for reliability.
        // Using new NextResponse(null, {headers}) can drop Set-Cookie in some
        // Next.js versions, so we parse and re-set cookies explicitly.
        const redirectUrl = location.startsWith('http')
          ? new URL(location)
          : new URL(location, request.nextUrl.origin);
        const redirectResponse = NextResponse.redirect(redirectUrl, response.status);

        // Collect Set-Cookie headers from backend response
        const rawCookies: string[] = [];
        const setCookieArray = (response.headers as any).getSetCookie?.() as string[] | undefined;
        if (setCookieArray && setCookieArray.length > 0) {
          rawCookies.push(...setCookieArray);
        } else {
          const fallback = response.headers.get('Set-Cookie');
          if (fallback) rawCookies.push(fallback);
        }

        // Parse and set each cookie using NextResponse's cookies API
        for (const raw of rawCookies) {
          console.log(`[API Proxy] Forwarding cookie on redirect: ${raw.split('=')[0]}...`);
          const parts = raw.split(';').map(s => s.trim());
          const [nameValue, ...attrs] = parts;
          const eqIdx = nameValue.indexOf('=');
          if (eqIdx === -1) continue;
          const name = nameValue.slice(0, eqIdx).trim();
          const value = nameValue.slice(eqIdx + 1);

          const options: Record<string, any> = {};
          for (const attr of attrs) {
            const aEq = attr.indexOf('=');
            const key = (aEq === -1 ? attr : attr.slice(0, aEq)).toLowerCase().trim();
            const val = aEq === -1 ? '' : attr.slice(aEq + 1).trim();
            if (key === 'httponly') options.httpOnly = true;
            else if (key === 'secure') options.secure = true;
            else if (key === 'path') options.path = val;
            else if (key === 'max-age') options.maxAge = parseInt(val) || 0;
            else if (key === 'samesite') options.sameSite = val.toLowerCase() as 'lax' | 'strict' | 'none';
            else if (key === 'domain') options.domain = val;
          }

          redirectResponse.cookies.set(name, value, options);
        }

        return redirectResponse;
      }
    }

    // Regular response - buffer and return
    const data = await response.text();

    // Build response headers, including Set-Cookie for session management
    const respHeaders = new Headers({
      'Content-Type': contentType || 'application/json',
    });

    // Forward Set-Cookie headers from backend (use getSetCookie for reliability)
    const respCookies = (response.headers as any).getSetCookie?.() as string[] | undefined;
    if (respCookies && respCookies.length > 0) {
      for (const c of respCookies) {
        respHeaders.append('Set-Cookie', c);
      }
    } else {
      const setCookie = response.headers.get('Set-Cookie');
      if (setCookie) {
        respHeaders.set('Set-Cookie', setCookie);
      }
    }

    // Return response with same status code
    return new NextResponse(data, {
      status: response.status,
      headers: respHeaders,
    });
  } catch (error: any) {
    console.error('[API Proxy] Error:', error.message);
    return NextResponse.json(
      { error: 'Backend connection failed', details: error.message },
      { status: 502 }
    );
  }
}
