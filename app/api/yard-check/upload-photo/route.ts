import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';

// Stores a failed-checklist-item photo in Vercel Blob and returns its public URL.
// Client resizes/compresses before upload; this route just hands the bytes off.
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    const filename = `yard-check/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const blob = await put(filename, file, { access: 'public', contentType: 'image/jpeg' });

    return NextResponse.json({ success: true, url: blob.url });
  } catch (error) {
    console.error('POST /api/yard-check/upload-photo error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
