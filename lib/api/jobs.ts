// =============================================
// Jobs API
// =============================================

import { api } from './client';
import { API_ENDPOINTS } from '@/utils/constants';
import type { Job, JobFormData, JobStatus, JobType } from '@/types';

interface JobQuery {
  driver_id?: string;
  status?: JobStatus;
  type?: JobType;
}

interface CreateJobData extends JobFormData {
  type: JobType;
  created_by: string;
  driver_id?: string;
}

/**
 * Fetch jobs with optional filters
 */
export async function getJobs(query?: JobQuery) {
  return api.get<Job[]>(API_ENDPOINTS.JOBS, query as Record<string, string>);
}

/**
 * Get job by ID
 */
export async function getJob(id: string) {
  return api.get<Job>(`${API_ENDPOINTS.JOBS}/${id}`);
}

/**
 * Create new job
 */
export async function createJob(data: CreateJobData) {
  return api.post<Job>(API_ENDPOINTS.JOBS, data);
}

/**
 * Update job
 */
export async function updateJob(id: string, data: Partial<Job>) {
  return api.put<Job>(`${API_ENDPOINTS.JOBS}/${id}`, data);
}

/**
 * Complete a job
 */
export async function completeJob(id: string) {
  return api.put<Job>(`${API_ENDPOINTS.JOBS}/${id}`, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

/**
 * Report issue on job
 */
export async function reportJobIssue(
  id: string,
  issueType: string,
  issueDetail?: string
) {
  return api.put<Job>(`${API_ENDPOINTS.JOBS}/${id}`, {
    status: 'issue',
    issue_type: issueType,
    issue_detail: issueDetail,
  });
}

/**
 * Check if dock is occupied
 */
export async function checkDockOccupancy(dock: string) {
  return api.get<{ occupied: boolean; containerNo?: string }>(
    API_ENDPOINTS.JOBS_CHECK_DOCK,
    { dock }
  );
}

/**
 * Get job count by status
 */
export async function getJobCount(status?: JobStatus) {
  return api.get<{ count: number }>(
    API_ENDPOINTS.JOBS_COUNT,
    status ? { status } : undefined
  );
}
