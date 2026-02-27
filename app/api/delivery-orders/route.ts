import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import DeliveryOrder from '@/lib/models/DeliveryOrder';
import { triggerDOEvent, PUSHER_EVENTS } from '@/lib/pusher';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const date_from = searchParams.get('date_from') || '';
    const date_to = searchParams.get('date_to') || '';
    const destination_branch = searchParams.get('destination_branch') || '';
    const document_date = searchParams.get('document_date') || '';
    const missing_trip_no = searchParams.get('missing_trip_no') === '1';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const conditions: Record<string, unknown>[] = [];

    if (document_date) {
      conditions.push({ document_date });
    }

    if (missing_trip_no) {
      conditions.push({ $or: [{ trip_no: '' }, { trip_no: { $exists: false } }, { trip_no: null }] });
    }

    if (destination_branch) {
      conditions.push({ destination_branch: { $regex: destination_branch, $options: 'i' } });
    }

    if (date_from || date_to) {
      const dateQuery: Record<string, string> = {};
      if (date_from) dateQuery.$gte = date_from;
      if (date_to) dateQuery.$lte = date_to;
      conditions.push({ delivery_date: dateQuery });
    }

    if (search) {
      conditions.push({
        $or: [
          { dc_number: { $regex: search, $options: 'i' } },
          { driver_name: { $regex: search, $options: 'i' } },
          { truck_plate_head: { $regex: search, $options: 'i' } },
          { truck_plate_tail: { $regex: search, $options: 'i' } },
          { destination_branch: { $regex: search, $options: 'i' } },
          { driver_phone: { $regex: search, $options: 'i' } },
          { trip_no: { $regex: search, $options: 'i' } },
        ],
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const skip = (page - 1) * limit;
    const [records, total] = await Promise.all([
      DeliveryOrder.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-scan_image')
        .lean(),
      DeliveryOrder.countDocuments(query),
    ]);

    return NextResponse.json({
      success: true,
      data: records,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error('GET delivery-orders error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    const record = new DeliveryOrder({
      dc_number: body.dc_number || '',
      document_date: body.document_date || '',
      document_time: body.document_time || '',
      delivery_date: body.delivery_date || '',
      delivery_time: body.delivery_time || '',
      return_date: body.return_date || '',
      return_time: body.return_time || '',
      driver_name: body.driver_name || '',
      driver_name_2: body.driver_name_2 || '',
      driver_phone: body.driver_phone || '',
      truck_plate_head: body.truck_plate_head || '',
      truck_plate_tail: body.truck_plate_tail || '',
      vehicle_type: body.vehicle_type || '',
      destination_branch: body.destination_branch || '',
      destination_address: body.destination_address || '',
      scan_image: body.scan_image || '',
      status: 'pending',
      trip_no: body.trip_no || '',
      notes: body.notes || '',
    });

    await record.save();
    triggerDOEvent(PUSHER_EVENTS.DO_CREATED, { id: record._id.toString() });

    return NextResponse.json({ success: true, data: record }, { status: 201 });
  } catch (error: unknown) {
    console.error('POST delivery-orders error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
