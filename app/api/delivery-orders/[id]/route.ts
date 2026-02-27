import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DeliveryOrder from '@/lib/models/DeliveryOrder';
import { triggerDOEvent, PUSHER_EVENTS } from '@/lib/pusher';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const record = await DeliveryOrder.findById(id).lean();

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    console.error('GET delivery-order error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await request.json();

    const record = await DeliveryOrder.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    ).lean();

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    triggerDOEvent(PUSHER_EVENTS.DO_UPDATED, { id });

    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
    console.error('PUT delivery-order error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const record = await DeliveryOrder.findByIdAndDelete(id);

    if (!record) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    triggerDOEvent(PUSHER_EVENTS.DO_DELETED, { id });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DELETE delivery-order error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
