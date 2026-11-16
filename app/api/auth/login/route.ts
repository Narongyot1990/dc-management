import { NextRequest, NextResponse } from 'next/server';
import { verifyCredentials, createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Missing username or password' }, { status: 400 });
    }

    const session = verifyCredentials(username, password);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
    }

    const token = await createSessionToken(session);
    const response = NextResponse.json({ success: true, user: session });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return response;
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json({ success: false, error: 'Login failed' }, { status: 500 });
  }
}
