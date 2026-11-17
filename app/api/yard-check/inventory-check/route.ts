import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import YardCheck from '@/lib/models/YardCheck';
import { requireAuth } from '@/lib/auth';
import { triggerYardCheckEvent } from '@/lib/pusher';

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

interface NewAssetInput {
  type: 'empty' | 'laden' | 'chassis';
  container_no?: string;
  size?: '20GP' | '40GP' | '40HC';
  chassis_plate: string;
  seal_no?: string;
  remark?: string;
}

// POST /api/yard-check/inventory-check
// A morning reconciliation walkthrough: every record still marked "in" gets
// either confirmed present (stillHereIds - no field changes, just a quiet
// history entry so the displayed check-in time never shifts to "now") or
// implicitly marked OUT (anything not ticked), plus any newly-found
// containers get created. Applied as one batch so Cancel on the client
// never has to partially undo anything - nothing is written until Confirm.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    if (session instanceof NextResponse) return session;

    await connectDB();
    const body = await request.json();

    const stillHereIds: string[] = Array.isArray(body.stillHereIds) ? body.stillHereIds : [];
    const newAssets: NewAssetInput[] = Array.isArray(body.newAssets) ? body.newAssets : [];

    const inYard = await YardCheck.find({ yard_status: 'in' });
    const stillHereSet = new Set(stillHereIds);

    let verifiedCount = 0;
    let markedOutCount = 0;
    const now = new Date();

    for (const check of inYard) {
      if (!check.history) check.history = [];
      if (stillHereSet.has(check.id)) {
        check.history.push({ action: 'verify', at: now, changes: 'inventory check: still here' });
        verifiedCount++;
      } else {
        check.yard_status = 'out';
        check.updated_at = now;
        check.history.push({ action: 'out', at: now, changes: 'in -> out (inventory check)' });
        markedOutCount++;
      }
      await check.save();
    }

    const createdIds: string[] = [];
    for (const asset of newAssets) {
      if (!asset.type || !asset.chassis_plate) continue;
      if ((asset.type === 'empty' || asset.type === 'laden') && (!asset.container_no || !asset.size)) continue;

      const checkId = await generateCheckId();
      const isEmpty = asset.type === 'empty';
      const created = await YardCheck.create({
        id: checkId,
        type: asset.type,
        container_no: asset.type === 'chassis' ? null : asset.container_no!.toUpperCase(),
        size: asset.type === 'chassis' ? null : asset.size,
        chassis_plate: asset.chassis_plate.toUpperCase(),
        seal_no: asset.type === 'laden' ? (asset.seal_no || undefined) : undefined,
        yard: 'YZZ',
        yard_status: 'in',
        inspection_status: isEmpty ? 'pending' : null,
        checklist: isEmpty ? [1, 2, 3, 4, 5].map((item) => ({ item, result: null })) : undefined,
        remark: asset.remark || undefined,
        checked_at: now,
        checked_by: session.username,
        history: [{ action: 'create', at: now, changes: 'found during inventory check' }],
      });
      createdIds.push(created.id);
    }

    if (verifiedCount || markedOutCount || createdIds.length) {
      await triggerYardCheckEvent('inventory-check');
    }

    return NextResponse.json({
      success: true,
      verifiedCount,
      markedOutCount,
      createdCount: createdIds.length,
    });
  } catch (error) {
    console.error('POST /api/yard-check/inventory-check error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
