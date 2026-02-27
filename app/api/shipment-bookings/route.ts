import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ShipmentBooking from '@/lib/models/ShipmentBooking';
import { triggerBookingEvent, PUSHER_EVENTS } from '@/lib/pusher';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const pickup_date = searchParams.get('pickup_date') || '';
    const truck_plate = searchParams.get('truck_plate') || '';

    const conditions: Record<string, unknown>[] = [];

    if (pickup_date) {
      conditions.push({ pickup_date });
    }
    if (truck_plate) {
      conditions.push({ truck_plate_head: { $regex: truck_plate, $options: 'i' } });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const records = await ShipmentBooking.find(query)
      .sort({ pickup_time: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: records,
      total: records.length,
    });
  } catch (error: unknown) {
    console.error('GET shipment-bookings error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const bookings = body.bookings;

    if (!Array.isArray(bookings) || bookings.length === 0) {
      return NextResponse.json(
        { success: false, error: 'bookings array is required' },
        { status: 400 }
      );
    }

    const docs = bookings.map((b: { pickup_date?: string; destination_branch?: string; pickup_time?: string; truck_plate_head?: string; dock_number?: string; notes?: string }) => ({
      pickup_date: b.pickup_date || '',
      destination_branch: b.destination_branch || '',
      pickup_time: b.pickup_time || '',
      truck_plate_head: b.truck_plate_head || '',
      dock_number: b.dock_number || '',
      status: 'draft',
      matched_do_id: '',
      notes: b.notes || '',
    }));

    const created = await ShipmentBooking.insertMany(docs);

    for (const doc of created) {
      triggerBookingEvent(PUSHER_EVENTS.BOOKING_CREATED, { id: doc._id.toString() });
    }

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST shipment-bookings error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
