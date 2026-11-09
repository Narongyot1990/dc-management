import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import YardCheck from '@/lib/models/YardCheck';

// Helper: Generate next check ID (YC001, YC002, ...)
async function generateCheckId(): Promise<string> {
  const lastCheck = await YardCheck.findOne({}, { id: 1 })
    .sort({ id: -1 })
    .lean();

  if (!lastCheck || !lastCheck.id) {
    return 'YC001';
  }

  const lastNum = parseInt(lastCheck.id.replace('YC', ''), 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
  return `YC${String(nextNum).padStart(3, '0')}`;
}

// GET /api/yard-check
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);

    const query: Record<string, unknown> = {};

    const type = searchParams.get('type');
    const yardStatus = searchParams.get('yard_status');
    const inspectionStatus = searchParams.get('inspection_status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search');

    if (type) query.type = type;
    if (yardStatus) query.yard_status = yardStatus;
    if (inspectionStatus) query.inspection_status = inspectionStatus;

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
      query.$or = [
        { container_no: { $regex: search, $options: 'i' } },
        { chassis_plate: { $regex: search, $options: 'i' } },
      ];
    }

    const checks = await YardCheck.find(query).sort({ checked_at: -1 });
    return NextResponse.json({ success: true, data: checks });
  } catch (error) {
    console.error('GET /api/yard-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/yard-check (always creates a new record — each yard visit is a new event)
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.type || !body.chassis_plate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, chassis_plate' },
        { status: 400 }
      );
    }

    if ((body.type === 'empty' || body.type === 'laden') && (!body.container_no || !body.size)) {
      return NextResponse.json(
        { success: false, error: 'container_no and size are required for empty/laden' },
        { status: 400 }
      );
    }

    const checkId = await generateCheckId();
    const now = new Date();
    const isEmpty = body.type === 'empty';

    const check = await YardCheck.create({
      id: checkId,
      type: body.type,
      container_no: body.type === 'chassis' ? null : body.container_no.toUpperCase(),
      size: body.type === 'chassis' ? null : body.size,
      chassis_plate: body.chassis_plate.toUpperCase(),
      seal_no: body.type === 'laden' ? (body.seal_no || undefined) : undefined,
      yard: body.yard || 'YZZ',
      yard_status: 'in',
      inspection_status: isEmpty ? 'pending' : null,
      checklist: isEmpty ? [1, 2, 3, 4, 5].map((item) => ({ item, result: null })) : undefined,
      remark: body.remark || undefined,
      checked_at: now,
      checked_by: body.checked_by || 'CHK001',
      history: [{ action: 'create', at: now }],
    });

    return NextResponse.json({ success: true, data: check }, { status: 201 });
  } catch (error) {
    console.error('POST /api/yard-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// PUT /api/yard-check (update by id: checklist progress, mark OUT, or remark)
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const check = await YardCheck.findOne({ id: body.id });
    if (!check) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    if (!check.history) check.history = [];

    // Edit record fields (fix typos, etc.)
    const editableFields = ['container_no', 'size', 'chassis_plate', 'seal_no'] as const;
    const edits: string[] = [];
    for (const field of editableFields) {
      if (body[field] === undefined) continue;
      const nextValue = typeof body[field] === 'string' ? body[field].toUpperCase() : body[field];
      if (check[field] !== nextValue) {
        edits.push(field);
        check[field] = nextValue;
      }
    }
    if (edits.length > 0) {
      check.history.push({ action: 'update', at: new Date(), changes: `edited: ${edits.join(', ')}` });
    }

    // Update checklist progress (inspection)
    if (body.checklist) {
      check.checklist = body.checklist;
      const allPass = (body.checklist as { result: string | null }[]).every((c) => c.result === 'pass');
      check.inspection_status = allPass ? 'passed' : 'pending';
      if (body.ng_detail !== undefined) check.ng_detail = body.ng_detail;
      check.history.push({ action: 'inspect', at: new Date(), changes: `inspection -> ${check.inspection_status}` });
    }

    // Mark OUT
    if (body.yard_status === 'out' && check.yard_status !== 'out') {
      check.yard_status = 'out';
      check.history.push({ action: 'out', at: new Date(), changes: 'in -> out' });
    }

    if (body.remark !== undefined) check.remark = body.remark;

    check.updated_at = new Date();
    await check.save();

    return NextResponse.json({ success: true, data: check });
  } catch (error) {
    console.error('PUT /api/yard-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// DELETE /api/yard-check
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

    const result = await YardCheck.findOneAndDelete({ id });
    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: `Deleted ${id}` });
  } catch (error) {
    console.error('DELETE /api/yard-check error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
