import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Booking from '@/lib/models/Booking';
import { triggerBookingEvent, PUSHER_EVENTS } from '@/lib/pusher';

// GET /api/bookings - Get all bookings
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const container = searchParams.get('container'); // Exact match for container

    const query: Record<string, unknown> = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Exact match for container_no (for linking with job)
    if (container) {
      query.container_no = { $regex: `^${container}$`, $options: 'i' };
    }
    // Search by booking_no, container_no, or vendor_name (partial match)
    else if (search) {
      query.$or = [
        { booking_no: { $regex: search, $options: 'i' } },
        { container_no: { $regex: search, $options: 'i' } },
        { vendor_name: { $regex: search, $options: 'i' } },
        { truck_plate: { $regex: search, $options: 'i' } },
      ];
    }

    const bookings = await Booking.find(query).sort({ created_at: -1 });

    return NextResponse.json({ success: true, data: bookings });
  } catch (error) {
    console.error('GET /api/bookings error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper: Generate next booking ID (safer than countDocuments)
async function generateBookingId(): Promise<string> {
  const lastBooking = await Booking.findOne({}, { id: 1 })
    .sort({ id: -1 })
    .lean();

  if (!lastBooking || !lastBooking.id) {
    return 'BK0001';
  }

  // Extract number from ID (e.g., "BK0042" -> 42)
  const lastNum = parseInt(lastBooking.id.replace('BK', ''), 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;

  return `BK${String(nextNum).padStart(4, '0')}`;
}

// POST /api/bookings - Create new booking
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    // Validate required fields
    const requiredFields = ['booking_no', 'container_no', 'seal_no', 'vendor_name', 'truck_plate'];
    const missingFields = requiredFields.filter(field => !body[field]);
    if (missingFields.length > 0) {
      return NextResponse.json(
        { success: false, error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Generate booking ID (safer method)
    const bookingId = await generateBookingId();

    const bookingData = {
      id: bookingId,
      ...body,
      status: body.status || 'pending',
      created_at: new Date(),
    };

    const booking = await Booking.create(bookingData);

    // Trigger Pusher event for real-time updates
    await triggerBookingEvent(PUSHER_EVENTS.BOOKING_CREATED, {
      id: booking.id,
      booking_no: booking.booking_no,
      container_no: booking.container_no,
      status: booking.status,
    });

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bookings error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
