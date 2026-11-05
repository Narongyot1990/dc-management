import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Job from '@/lib/models/Job';
import Booking from '@/lib/models/Booking';
import { triggerJobEvent, PUSHER_EVENTS } from '@/lib/pusher';

// Helper: Generate next job ID (safer than countDocuments)
async function generateJobId(): Promise<string> {
  const lastJob = await Job.findOne({}, { id: 1 })
    .sort({ id: -1 })
    .lean();

  if (!lastJob || !lastJob.id) {
    return 'J001';
  }

  // Extract number from ID (e.g., "J042" -> 42)
  const lastNum = parseInt(lastJob.id.replace('J', ''), 10);
  const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;

  return `J${String(nextNum).padStart(3, '0')}`;
}

// Helper: Check if dock is currently occupied
async function isDockOccupied(dock: string): Promise<{ occupied: boolean; containerNo?: string }> {
  // Find the latest completed IN job for this dock
  const latestIn = await Job.findOne({
    type: 'in',
    dock_to: dock,
    status: 'completed'
  }).sort({ completed_at: -1, created_at: -1 }).lean();

  if (!latestIn) {
    return { occupied: false };
  }

  // Find the latest completed OUT job for this dock after the IN
  const latestOut = await Job.findOne({
    type: 'out',
    dock_from: dock,
    status: 'completed',
    $or: [
      { completed_at: { $gt: latestIn.completed_at || latestIn.created_at } },
      { created_at: { $gt: latestIn.completed_at || latestIn.created_at } }
    ]
  }).lean();

  // If no OUT after IN, dock is occupied
  if (!latestOut) {
    return { occupied: true, containerNo: latestIn.container_no };
  }

  return { occupied: false };
}

// GET /api/jobs - Get all jobs or filter by driver_id/status
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const driver_id = searchParams.get('driver_id');
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    const query: Record<string, unknown> = {};
    if (driver_id) query.driver_id = driver_id;
    if (status) query.status = status;
    if (type) query.type = type;

    const jobs = await Job.find(query).sort({ created_at: -1 });

    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.error('GET /api/jobs error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/jobs - Create new job
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();

    // Validate required fields
    if (!body.type || !body.container_no || !body.created_by) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: type, container_no, created_by' },
        { status: 400 }
      );
    }

    // Validate dock for IN jobs
    if (body.type === 'in') {
      if (!body.dock_to) {
        return NextResponse.json(
          { success: false, error: 'dock_to is required for IN jobs' },
          { status: 400 }
        );
      }

      // Check if purpose is provided
      if (!body.purpose) {
        return NextResponse.json(
          { success: false, error: 'purpose is required for IN jobs (for_loading or for_unloading)' },
          { status: 400 }
        );
      }

      // Check dock occupancy (warning only, don't block - handled by frontend)
      const dockStatus = await isDockOccupied(body.dock_to);
      if (dockStatus.occupied) {
        // Include warning in response but still allow creation
        console.warn(`Warning: Dock ${body.dock_to} is occupied by ${dockStatus.containerNo}`);
      }
    }

    // Validate dock for OUT jobs
    if (body.type === 'out') {
      if (!body.dock_from) {
        return NextResponse.json(
          { success: false, error: 'dock_from is required for OUT jobs' },
          { status: 400 }
        );
      }

      // Check if completion_status is provided
      if (!body.completion_status) {
        return NextResponse.json(
          { success: false, error: 'completion_status is required for OUT jobs (completed or incomplete)' },
          { status: 400 }
        );
      }
    }

    // Generate job ID (safer method)
    const jobId = await generateJobId();

    const jobData = {
      id: jobId,
      ...body,
      created_at: new Date(),
      status: 'pending'
    };

    const job = await Job.create(jobData);

    // Trigger Pusher event for real-time updates
    await triggerJobEvent(PUSHER_EVENTS.JOB_CREATED, {
      id: job.id,
      type: job.type,
      container_no: job.container_no,
      dock_from: job.dock_from,
      dock_to: job.dock_to,
      status: job.status,
      driver_id: job.driver_id,
    });

    return NextResponse.json({ success: true, data: job }, { status: 201 });
  } catch (error) {
    console.error('POST /api/jobs error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}
