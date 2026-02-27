import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DeliveryOrder from '@/lib/models/DeliveryOrder';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const dc = request.nextUrl.searchParams.get('dc') || '';
    if (!dc) {
      return NextResponse.json({ exists: false });
    }

    const existing = await DeliveryOrder.findOne(
      { dc_number: dc },
      { _id: 1, dc_number: 1, destination_branch: 1, delivery_date: 1 }
    ).lean();

    if (existing) {
      return NextResponse.json({ exists: true, record: existing });
    }

    return NextResponse.json({ exists: false });
  } catch (error: unknown) {
    console.error('check-dc error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ exists: false, error: msg }, { status: 500 });
  }
}
