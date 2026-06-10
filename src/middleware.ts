/**
 * middleware.ts — route protection for the dashboard.
 *
 * Protects all routes except /login, /api/login, /api/logout, and Next.js internals.
 * Validates the dash_session cookie using HMAC; redirects to /login on failure.
 *
 * NOTE: middleware runs in the Edge runtime, so we replicate the HMAC token
 * verification inline using the Web Crypto API (SubtleCrypto) — cannot import
 * Node.js `crypto` here.
 */

import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'dash_session';
const TOKEN_PAYLOAD = 'leadgen-lt-dashboard-v1';

/** Compute HMAC-SHA256 of payload using SubtleCrypto (Edge-compatible). */
async function computeTokenEdge(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(TOKEN_PAYLOAD));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time hex string comparison using SubtleCrypto verify. */
async function verifyTokenEdge(token: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  try {
    const expected = await computeTokenEdge(secret);
    // Use SubtleCrypto verify for constant-time comparison.
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    // Convert hex token back to bytes.
    if (token.length !== expected.length) return false;
    const tokenBytes = new Uint8Array(token.length / 2);
    for (let i = 0; i < token.length; i += 2) {
      tokenBytes[i / 2] = parseInt(token.slice(i, i + 2), 16);
    }
    return await crypto.subtle.verify('HMAC', key, tokenBytes, enc.encode(TOKEN_PAYLOAD));
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (login page, auth API routes, Next.js internals, static assets).
  if (
    pathname === '/login' ||
    pathname === '/api/login' ||
    pathname === '/api/logout' ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  const secret = process.env.DASHBOARD_PASSWORD ?? '';
  // Fail closed: if no password configured, deny everything.
  if (!secret) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const valid = await verifyTokenEdge(token, secret);
  if (!valid) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
