import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Job from '@/lib/models/Job';

/**
 * Check if a dock is available for a new container
 *
 * Logic:
 * - For Container IN: Check if dock already has an active container
 * - An "active" container is one that was brought IN but not yet OUT
 *
 * Returns:
 * - available: boolean
 * - currentContainer: string | null (last 5 digits if occupied)
 * - message: string (warning message if not available)
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const dock = searchParams.get('dock');
    const containerNo = searchParams.get('container_no');

    if (!dock) {
      return NextResponse.json(
        { success: false, error: 'Dock parameter is required' },
        { status: 400 }
      );
    }

    // Find the last job for this dock (either IN or OUT)
    // Sort by created_at descending to get the most recent
    const lastJob = await Job.findOne({
      $or: [
        { dock_to: dock, type: 'in' },
        { dock_from: dock, type: 'out' }
      ],
      status: { $in: ['pending', 'completed'] } // Exclude issue jobs
    }).sort({ created_at: -1 });

    // If no job found, dock is available
    if (!lastJob) {
      return NextResponse.json({
        success: true,
        available: true,
        currentContainer: null,
        message: null
      });
    }

    // If last job was OUT, dock is available
    if (lastJob.type === 'out') {
      return NextResponse.json({
        success: true,
        available: true,
        currentContainer: null,
        message: null
      });
    }

    // Last job was IN - dock is occupied
    const currentContainerNo = lastJob.container_no;
    const last5Current = currentContainerNo.slice(-5);

    // Check if user is trying to add the same container (last 5 digits)
    if (containerNo) {
      const last5New = containerNo.slice(-5);
      if (last5Current === last5New) {
        return NextResponse.json({
          success: true,
          available: false,
          currentContainer: currentContainerNo,
          isDuplicate: true,
          message: `Container with same ID (${last5New}) already exists at ${dock}`
        });
      }
    }

    // Dock is occupied with different container
    return NextResponse.json({
      success: true,
      available: false,
      currentContainer: currentContainerNo,
      isDuplicate: false,
      message: `Dock ${dock} is occupied by container ${currentContainerNo}. Please move it out first.`
    });

  } catch (error: unknown) {
    console.error('Error checking dock:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check dock availability' },
      { status: 500 }
    );
  }
}
