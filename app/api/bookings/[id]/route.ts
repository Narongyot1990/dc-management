import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Booking from '@/lib/models/Booking';
import { triggerBookingEvent, PUSHER_EVENTS } from '@/lib/pusher';

// GET /api/bookings/[id] - Get single booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const booking = await Booking.findOne({ id });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: booking });
  } catch (error) {
    console.error('GET /api/bookings/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/bookings/[id] - Update booking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const body = await request.json();
    body.updated_at = new Date();

    const booking = await Booking.findOneAndUpdate(
      { id },
      body,
      { new: true, runValidators: true }
    );

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    // Trigger appropriate Pusher event
    const eventType = body.job_id ? PUSHER_EVENTS.BOOKING_LINKED : PUSHER_EVENTS.BOOKING_UPDATED;
    await triggerBookingEvent(eventType, {
      id: booking.id,
      booking_no: booking.booking_no,
      container_no: booking.container_no,
      status: booking.status,
      job_id: booking.job_id,
    });

    return NextResponse.json({ success: true, data: booking });
  } catch (error) {
    console.error('PUT /api/bookings/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// DELETE /api/bookings/[id] - Delete booking
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const booking = await Booking.findOneAndDelete({ id });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: 'Booking not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: booking });
  } catch (error) {
    console.error('DELETE /api/bookings/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
