import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ContainerCheck from '@/lib/models/ContainerCheck';

// GET /api/container-check/migrate — one-time migration
export async function GET() {
  try {
    await connectDB();

    // Migration: location
    const locPending = await ContainerCheck.updateMany(
      { location: 'pending' },
      { $set: { location: 'yard' } }
    );
    const locLoading = await ContainerCheck.updateMany(
      { location: 'loading' },
      { $set: { location: 'dock' } }
    );

    // Migration: status
    const stComplete = await ContainerCheck.updateMany(
      { status: 'complete' },
      { $set: { status: 'loaded' } }
    );
    const stIncomplete = await ContainerCheck.updateMany(
      { status: 'incomplete' },
      { $set: { status: 'pending' } }
    );

    // Migration: vendor Unknown → U-Globe
    const vendorUnknown = await ContainerCheck.updateMany(
      { vendor: 'Unknown' },
      { $set: { vendor: 'U-Globe' } }
    );

    // Migration: dock + pending → loading (containers at dock should be loading, not pending)
    const dockPendingToLoading = await ContainerCheck.updateMany(
      { location: 'dock', status: 'pending' },
      { $set: { status: 'loading' } }
    );

    // Migration: initialize history for records that don't have it
    // Use checked_at as the initial "create" timestamp
    const noHistory = await ContainerCheck.find({
      $or: [{ history: { $exists: false } }, { history: { $size: 0 } }, { history: null }]
    });
    let historyInitCount = 0;
    for (const doc of noHistory) {
      doc.history = [{ action: 'create' as const, at: doc.checked_at || new Date() }];
      await doc.save();
      historyInitCount++;
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results: {
        location_pending_to_yard: locPending.modifiedCount,
        location_loading_to_dock: locLoading.modifiedCount,
        status_complete_to_loaded: stComplete.modifiedCount,
        status_incomplete_to_pending: stIncomplete.modifiedCount,
        vendor_unknown_to_uglobe: vendorUnknown.modifiedCount,
        dock_pending_to_loading: dockPendingToLoading.modifiedCount,
        history_initialized: historyInitCount,
      },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
