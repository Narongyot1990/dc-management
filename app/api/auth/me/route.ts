import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ success: true, user: null });
  }
  return NextResponse.json({ success: true, user: session });
}
