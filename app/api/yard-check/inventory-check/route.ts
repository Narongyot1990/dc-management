import type { ClientSession } from 'mongoose';
import { findYardAssetConflict, normalizeYardAssetId } from '@/utils/yardAssetIdentity';
import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import YardCheck from '@/lib/models/YardCheck';
import { requireAuth } from '@/lib/auth';
import { triggerYardCheckEvent } from '@/lib/pusher';

// Helper: Generate next check ID (YC001, YC002, ...)
async function generateCheckId(session: ClientSession): Promise<string> {
  const lastCheck = await YardCheck.findOne({}, { id: 1 })
    .sort({ id: -1 })
    .session(session)
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

class InventoryConflict extends Error {}

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

    const db = await connectDB();
    const body = await request.json();

    const stillHereIds: string[] = Array.isArray(body.stillHereIds) ? body.stillHereIds : [];
    const newAssets: NewAssetInput[] = Array.isArray(body.newAssets) ? body.newAssets : [];

    const normalizedAssets: NewAssetInput[] = [];
    for (const asset of newAssets) {
      if (!asset || !['empty', 'laden', 'chassis'].includes(asset.type) ||
          typeof asset.chassis_plate !== 'string' || !normalizeYardAssetId(asset.chassis_plate) ||
          (asset.type !== 'chassis' && (typeof asset.container_no !== 'string' ||
            !normalizeYardAssetId(asset.container_no) || !['20GP', '40GP', '40HC'].includes(asset.size ?? '')))) {
        return NextResponse.json({ success: false, error: 'Invalid new asset. Check the plate, container number and size.' }, { status: 400 });
      }
      normalizedAssets.push({
        ...asset,
        container_no: normalizeYardAssetId(asset.container_no),
        chassis_plate: normalizeYardAssetId(asset.chassis_plate),
      });
    }

    await YardCheck.init();
    const { verifiedCount, markedOutCount, createdIds } = await db.connection.transaction(async (transaction) => {
      const inYard = await YardCheck.find({ yard_status: 'in' }).session(transaction);
      const accepted: NewAssetInput[] = [];
      for (const asset of normalizedAssets) {
        const conflict = findYardAssetConflict(asset, inYard) ?? findYardAssetConflict(asset, accepted);
        if (conflict) {
          const value = conflict.key === 'container' ? asset.container_no : asset.chassis_plate;
          throw new InventoryConflict(`Duplicate ${conflict.key === 'container' ? 'container number' : 'chassis plate'}: ${normalizeYardAssetId(value)}`);
        }
        accepted.push(asset);
      }
      const knownIds = new Set(Array.isArray(body.knownInYardIds) ? body.knownInYardIds : inYard.map(record => record.id));
      if (knownIds.size !== inYard.length || inYard.some(record => !knownIds.has(record.id))) {
        throw new InventoryConflict('The yard list changed. Reload the page and review your saved draft before confirming.');
      }
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
        await check.save({ session: transaction });
      }

      const createdIds: string[] = [];
      for (const asset of normalizedAssets) {
        const checkId = await generateCheckId(transaction);
        const isEmpty = asset.type === 'empty';
        const created = new YardCheck({
          id: checkId,
          type: asset.type,
          container_no: asset.type === 'chassis' ? null : asset.container_no,
          size: asset.type === 'chassis' ? null : asset.size,
          chassis_plate: asset.chassis_plate,
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
        await created.save({ session: transaction });
        createdIds.push(created.id);
      }

      return { verifiedCount, markedOutCount, createdIds };
    });

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
    if (error instanceof InventoryConflict) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({
        success: false,
        error: 'A conflicting asset was saved while you were counting. Reload the page and review your saved draft.',
      }, { status: 409 });
    }
    console.error('POST /api/yard-check/inventory-check error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 400 }
    );
  }
}
