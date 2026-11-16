import { SignJWT, jwtVerify } from 'jose';
import { scryptSync, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const SESSION_COOKIE = 'yard_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type Role = 'checker' | 'admin';

export interface SessionPayload {
  username: string;
  role: Role;
}

// Two fixed accounts, per the current requirement - no DB-backed user
// management yet. Passwords are never stored in plaintext: each entry is
// `salt:scryptHash` (hex), generated once offline.
const ACCOUNTS: { username: string; role: Role; passwordHash: string }[] = [
  {
    username: 'checker',
    role: 'checker',
    passwordHash: '816de74e513a4b6a638f9d461ccf3a14:d335e1d6315adf41a020eba53e3654f888eea26cc3c8164e7bc5ff9ece8307531ba12755a1318e0b9c456231d5ad102bec8f651135880b01d50fdcbfdcd7a189',
  },
  {
    username: 'admin',
    role: 'admin',
    passwordHash: '623ba46c8cef3316164f9614e7fa43be:a84b80ef5bef5013f5e278d43aee00da418761f4105080e0e8d7d0e7f2bb1704a25751b4120e7497e0e96539cfe820b577710ea9ce0d6ef848b5300438a70ddf',
  },
];

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const candidate = scryptSync(password, salt, expected.length);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function verifyCredentials(username: string, password: string): SessionPayload | null {
  const account = ACCOUNTS.find((a) => a.username === username);
  if (!account || !verifyPassword(password, account.passwordHash)) return null;
  return { username: account.username, role: account.role };
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not configured');
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.username !== 'string' || typeof payload.role !== 'string') return null;
    return { username: payload.username, role: payload.role as Role };
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie from an API route's request. */
export async function getSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Guard for mutating route handlers. Use as:
 *   const session = await requireAuth(request);
 *   if (session instanceof NextResponse) return session;
 * General (anonymous) access is read-only - every Create/Update/Delete
 * handler must call this first, since hiding buttons client-side is only
 * a UX nicety, not an enforcement boundary.
 */
export async function requireAuth(request: NextRequest): Promise<SessionPayload | NextResponse> {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Login required' }, { status: 401 });
  }
  return session;
}
