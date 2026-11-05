import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Job from '@/lib/models/Job';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const driver_id = searchParams.get('driver_id');

    // Build query
    const query: Record<string, string> = { status };
    if (driver_id) {
      query.driver_id = driver_id;
    }

    // Get count only (lightweight)
    const count = await Job.countDocuments(query);

    return NextResponse.json({
      success: true,
      count,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error('Error counting jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to count jobs', count: 0 },
      { status: 500 }
    );
  }
}
