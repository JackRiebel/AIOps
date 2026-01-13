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

    // Handle redirect responses (e.g., OAuth redirects to Google)
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      if (location) {
        console.log(`[API Proxy] Redirect ${response.status} to: ${location}`);
        // Return a proper redirect response with Location header
        // Don't use NextResponse.redirect() as it can modify the URL
        return new NextResponse(null, {
          status: response.status,
          headers: {
            'Location': location,
          },
        });
      }
    }

    // Regular response - buffer and return
    const data = await response.text();

    // Build response headers, including Set-Cookie for session management
    const responseHeaders: HeadersInit = {
      'Content-Type': contentType || 'application/json',
    };

    // Forward Set-Cookie headers from backend
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) {
      responseHeaders['Set-Cookie'] = setCookie;
    }

    // Return response with same status code
    return new NextResponse(data, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error('[API Proxy] Error:', error.message);
    return NextResponse.json(
      { error: 'Backend connection failed', details: error.message },
      { status: 502 }
    );
  }
}
