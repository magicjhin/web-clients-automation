/**
 * api/logout/route.ts — clears the session cookie.
 *
 * POST → deletes dash_session cookie, redirects to /login.
 */

import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  );
  response.cookies.delete(COOKIE_NAME);
  return response;
}

// Also support GET for simple <a href="/api/logout"> links.
export async function GET() {
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  );
  response.cookies.delete(COOKIE_NAME);
  return response;
}
