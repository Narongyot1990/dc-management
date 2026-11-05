import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Job from '@/lib/models/Job';
import Booking from '@/lib/models/Booking';
import { triggerJobEvent, triggerDockEvent, triggerBookingEvent, PUSHER_EVENTS } from '@/lib/pusher';

// Helper: Sync booking status based on job completion
async function syncBookingStatus(job: {
  id: string;
  type: string;
  container_no: string;
  status: string;
  completion_status?: string;
}) {
  try {
    // Find linked booking by container_no and job_id
    const booking = await Booking.findOne({
      $or: [
        { job_id: job.id },
        { container_no: job.container_no, status: 'in_progress' }
      ]
    });

    if (!booking) {
      console.log(`No linked booking found for job ${job.id}`);
      return;
    }

    let newBookingStatus: string | null = null;

    // Logic: Sync booking status based on job type and completion
    if (job.status === 'completed') {
      if (job.type === 'out') {
        // OUT job completed
        if (job.completion_status === 'completed') {
          newBookingStatus = 'completed';
        } else if (job.completion_status === 'incomplete') {
          newBookingStatus = 'incomplete';
        }
      }
      // IN job completed → booking stays in_progress (no change needed)
    } else if (job.status === 'issue') {
      // Job has issue → could mark booking as incomplete or keep in_progress
      // For now, we keep it in_progress so it can be retried
      console.log(`Job ${job.id} has issue, booking ${booking.id} stays in_progress`);
    }

    // Update booking if status changed
    if (newBookingStatus && booking.status !== newBookingStatus) {
      await Booking.findOneAndUpdate(
        { id: booking.id },
        {
          status: newBookingStatus,
          updated_at: new Date()
        }
      );
      console.log(`Booking ${booking.id} status updated to ${newBookingStatus}`);
    }
  } catch (error) {
    console.error('Error syncing booking status:', error);
    // Don't throw - this is a side effect, shouldn't fail the main operation
  }
}

// GET /api/jobs/[id] - Get single job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const job = await Job.findOne({ id });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error('GET /api/jobs/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// PUT /api/jobs/[id] - Update job (complete, report issue, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const body = await request.json();

    // If marking as completed, set completed_at timestamp
    if (body.status === 'completed' && !body.completed_at) {
      body.completed_at = new Date();
    }

    const job = await Job.findOneAndUpdate(
      { id },
      body,
      { new: true, runValidators: true }
    );

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    const jobEventData = {
      id: job.id,
      type: job.type,
      container_no: job.container_no,
      dock_from: job.dock_from,
      dock_to: job.dock_to,
      status: job.status,
      driver_id: job.driver_id,
      priority: job.priority,
    };

    // Sync booking status after job update
    if (body.status === 'completed' || body.status === 'issue') {
      await syncBookingStatus({
        id: job.id,
        type: job.type,
        container_no: job.container_no,
        status: job.status,
        completion_status: job.completion_status,
      });

      if (body.status === 'completed') {
        await triggerJobEvent(PUSHER_EVENTS.JOB_COMPLETED, jobEventData);

        // Trigger dock update
        const dock = job.type === 'in' ? job.dock_to : job.dock_from;
        if (dock) {
          await triggerDockEvent({
            dock,
            occupied: job.type === 'in',
            containerNo: job.type === 'in' ? job.container_no : undefined,
          });
        }
      } else if (body.status === 'issue') {
        await triggerJobEvent(PUSHER_EVENTS.JOB_ISSUE, jobEventData);
      }
    }

    if (body.status === 'cancelled' || typeof body.priority === 'number') {
      await triggerJobEvent(PUSHER_EVENTS.JOB_UPDATED, jobEventData);
    }

    const editKeys = [
      'container_no',
      'dock_from',
      'dock_to',
      'remark',
      'driver_id',
      'purpose',
      'completion_status',
    ];

    const hasGeneralEdits = editKeys.some((k) => Object.prototype.hasOwnProperty.call(body, k));
    const isCompletedOrIssue = body.status === 'completed' || body.status === 'issue';
    if (hasGeneralEdits && !isCompletedOrIssue) {
      await triggerJobEvent(PUSHER_EVENTS.JOB_UPDATED, jobEventData);
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error('PUT /api/jobs/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 400 }
    );
  }
}

// DELETE /api/jobs/[id] - Delete job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();

    const job = await Job.findOneAndDelete({ id });

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: job });
  } catch (error) {
    console.error('DELETE /api/jobs/[id] error:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
