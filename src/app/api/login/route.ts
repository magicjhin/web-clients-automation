/**
 * api/login/route.ts — password authentication endpoint.
 *
 * POST { password: string } → validates against DASHBOARD_PASSWORD using
 * constant-time compare, sets httpOnly SameSite=Lax cookie on success.
 * Always returns JSON { ok: boolean, error?: string }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, COOKIE_NAME } from '@/lib/auth';

const IS_PROD = process.env.NODE_ENV === 'production';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('password' in body) ||
    typeof (body as Record<string, unknown>).password !== 'string'
  ) {
    return NextResponse.json({ ok: false, error: 'Password is required' }, { status: 400 });
  }

  const candidate = (body as { password: string }).password;

  // Fail closed: empty candidate always denied.
  if (!candidate) {
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  const token = verifyPassword(candidate);
  if (!token) {
    return NextResponse.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    path: '/',
    // 7 days
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
