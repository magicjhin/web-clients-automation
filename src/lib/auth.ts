/**
 * auth.ts — simple password-gate auth for the dashboard.
 *
 * Uses built-in Node.js crypto only (no next-auth, no JWT library).
 * HMAC-SHA256 signs a fixed payload using DASHBOARD_PASSWORD as the secret.
 * The resulting token is stored in an httpOnly cookie `dash_session`.
 *
 * Fail-closed: if DASHBOARD_PASSWORD is unset or empty, all logins are denied.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'dash_session';
// Fixed payload — the token only proves knowledge of the password.
const TOKEN_PAYLOAD = 'leadgen-lt-dashboard-v1';

/** Returns DASHBOARD_PASSWORD from env. Empty string if not set. */
function getSecret(): string {
  return process.env.DASHBOARD_PASSWORD ?? '';
}

/** Compute HMAC-SHA256 hex token from the fixed payload + secret. */
function computeToken(secret: string): string {
  return createHmac('sha256', secret).update(TOKEN_PAYLOAD).digest('hex');
}

/** Verify a password string in constant time. Returns token string on success, null on failure. */
export function verifyPassword(candidate: string): string | null {
  const secret = getSecret();
  // Fail closed: empty secret = always deny.
  if (!secret) return null;

  const expectedBuf = Buffer.from(secret, 'utf8');
  const candidateBuf = Buffer.from(candidate, 'utf8');

  // Pad to same length to prevent length-based timing leak.
  const maxLen = Math.max(expectedBuf.length, candidateBuf.length);
  const a = Buffer.alloc(maxLen);
  const b = Buffer.alloc(maxLen);
  expectedBuf.copy(a);
  candidateBuf.copy(b);

  if (!timingSafeEqual(a, b)) return null;

  return computeToken(secret);
}

/** Validate the token from the cookie. Returns true if valid. */
export function isValidToken(token: string): boolean {
  const secret = getSecret();
  if (!secret) return false;

  const expected = computeToken(secret);
  try {
    const expectedBuf = Buffer.from(expected, 'hex');
    const candidateBuf = Buffer.from(token, 'hex');
    if (expectedBuf.length !== candidateBuf.length) return false;
    return timingSafeEqual(expectedBuf, candidateBuf);
  } catch {
    return false;
  }
}

/** Read the session token from the request cookies (server component / middleware context). */
export function getSessionToken(): string | undefined {
  const cookieStore = cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/** Check if the current request is authenticated (server component context). */
export function isAuthenticated(): boolean {
  const token = getSessionToken();
  if (!token) return false;
  return isValidToken(token);
}

export { COOKIE_NAME };
