import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ShipmentBooking from '@/lib/models/ShipmentBooking';
import { triggerBookingEvent, PUSHER_EVENTS } from '@/lib/pusher';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;
    const record = await ShipmentBooking.findById(id).lean();
    if (!record) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: record });
  } catch (error: unknown) {
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

    const allowedFields = [
      'pickup_date', 'destination_branch', 'pickup_time', 'truck_plate_head', 'dock_number',
      'clock_in', 'loading_start', 'loading_end', 'arrival_branch', 'departure_branch', 'return_dc',
      'status', 'matched_do_id', 'notes',
    ];
    const updates: Record<string, string> = {};
    for (const key of allowedFields) {
      if (key in body) updates[key] = body[key];
    }

    const updated = await ShipmentBooking.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }
    triggerBookingEvent(PUSHER_EVENTS.BOOKING_UPDATED, { id });
    return NextResponse.json({ success: true, data: updated });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const { id } = await params;
    const deleted = await ShipmentBooking.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    triggerBookingEvent(PUSHER_EVENTS.BOOKING_DELETED, { id });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('DELETE shipment-booking error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
