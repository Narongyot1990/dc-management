import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ContainerCheck from '@/lib/models/ContainerCheck';

// Helper: Generate next check ID (CC001, CC002, ...)
async function generateCheckId(): Promise<string> {
  const lastCheck = await ContainerCheck.findOne({}, { id: 1 })
    .sort({ id: -1 })
    .lean();

  if (!lastCheck || !lastCheck.id) {
    return 'CC001';
  }

  const lastNum = parseInt(lastCheck.id.replace('CC', ''), 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
  return `CC${String(nextNum).padStart(3, '0')}`;
}

// Helper: Build a short changes summary string
function buildChanges(
  oldDoc: { location?: string; dock_no?: string | null; status?: string; vendor?: string },
  newData: { location?: string; dock_no?: string | null; status?: string; vendor?: string },
): string {
  const parts: string[] = [];
  if (newData.location && newData.location !== oldDoc.location) {
    const fromLoc = oldDoc.location === 'dock' && oldDoc.dock_no ? `${oldDoc.location} ${oldDoc.dock_no}` : oldDoc.location;
    const toLoc = newData.location === 'dock' && newData.dock_no ? `${newData.location} ${newData.dock_no}` : newData.location;
    parts.push(`${fromLoc}→${toLoc}`);
  } else if (newData.location === 'dock' && newData.dock_no && newData.dock_no !== oldDoc.dock_no) {
    parts.push(`${oldDoc.dock_no || 'dock'}→${newData.dock_no}`);
  }
  if (newData.status && newData.status !== oldDoc.status) {
    parts.push(`${oldDoc.status}→${newData.status}`);
  }
  if (newData.vendor && newData.vendor !== oldDoc.vendor) {
    parts.push(`${oldDoc.vendor}→${newData.vendor}`);
  }
  return parts.join(', ');
}

// GET /api/container-check
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const query: Record<string, unknown> = {};

    const vendor = searchParams.get('vendor');
    const status = searchParams.get('status');
    const location = searchParams.get('location');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    if (vendor) query.vendor = vendor;
    if (status) query.status = status;
    if (location) query.location = location;

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.$lte = end;
      }
      query.checked_at = dateFilter;
    }

    if (search) {
      query.container_no = { $regex: search, $options: 'i' };
    }

    const checks = await ContainerCheck.find(query).sort({ checked_at: -1 });
    return NextResponse.json({ success: true, data: checks });
  } catch (error) {
    console.error('GET /api/container-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/container-check (upsert: ถ้า container_no ซ้ำ จะ update แทน)
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.container_no || !body.vendor || !body.location || !body.status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: container_no, vendor, location, status' },
        { status: 400 }
      );
    }

    if (body.location === 'dock' && !body.dock_no) {
      return NextResponse.json(
        { success: false, error: 'dock_no is required when location is dock' },
        { status: 400 }
      );
    }

    const containerNo = body.container_no.toUpperCase();

    // Check if container_no already exists
    const existing = await ContainerCheck.findOne({ container_no: containerNo });

    // If mode is 'create', reject duplicates
    if (body.mode === 'create' && existing) {
      return NextResponse.json(
        { success: false, error: 'Container already exists', existing: existing.id },
        { status: 409 }
      );
    }

    if (existing) {
      // UPDATE existing record (upsert mode)
      const changes = buildChanges(existing, body);
      if (body.vendor) existing.vendor = body.vendor;
      existing.location = body.location;
      existing.dock_no = body.location === 'dock' ? body.dock_no : null;
      existing.status = body.status;
      if (body.remark !== undefined) existing.remark = body.remark;
      existing.updated_at = new Date();
      if (!existing.history) existing.history = [];
      existing.history.push({ action: 'update', at: new Date(), changes: changes || undefined });
      await existing.save();

      return NextResponse.json({
        success: true,
        data: existing,
        updated: true,
        message: `Updated existing record ${existing.id}`,
      });
    }

    // CREATE new record
    const checkId = await generateCheckId();
    const now = new Date();
    const check = await ContainerCheck.create({
      id: checkId,
      container_no: containerNo,
      vendor: body.vendor,
      location: body.location,
      dock_no: body.location === 'dock' ? body.dock_no : null,
      status: body.status,
      remark: body.remark || undefined,
      checked_at: now,
      checked_by: body.checked_by || 'CHK001',
      history: [{ action: 'create', at: now }],
    });

    return NextResponse.json({ success: true, data: check, updated: false }, { status: 201 });
  } catch (error) {
    console.error('POST /api/container-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// PUT /api/container-check (update by id)
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.id && !body.container_no) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id or container_no' },
        { status: 400 }
      );
    }

    // Lookup by id first, fallback to container_no
    const check = body.id
      ? await ContainerCheck.findOne({ id: body.id })
      : await ContainerCheck.findOne({ container_no: body.container_no.toUpperCase() });
    if (!check) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    // Build history entry before applying changes
    const isDeparting = body.status === 'departed' && check.status !== 'departed';
    const changes = buildChanges(check, body);
    const historyAction = isDeparting ? 'departed' : 'update';

    // Update only provided fields
    if (body.vendor) check.vendor = body.vendor;
    if (body.location) {
      check.location = body.location;
      check.dock_no = body.location === 'dock' ? (body.dock_no || check.dock_no) : null;
    }
    if (body.dock_no !== undefined) check.dock_no = body.dock_no;
    if (body.status) check.status = body.status;
    if (body.remark !== undefined) check.remark = body.remark;
    check.updated_at = new Date();
    if (!check.history) check.history = [];
    check.history.push({ action: historyAction, at: new Date(), changes: changes || undefined });

    await check.save();
    return NextResponse.json({ success: true, data: check });
  } catch (error) {
    console.error('PUT /api/container-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// DELETE /api/container-check
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required param: id' },
        { status: 400 }
      );
    }

    const result = await ContainerCheck.findOneAndDelete({ id });
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: `Deleted ${id}` });
  } catch (error) {
    console.error('DELETE /api/container-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
