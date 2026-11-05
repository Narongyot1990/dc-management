"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Job, JobStatus, ApiResponse } from '@/types';
import { API_ENDPOINTS, POLLING_INTERVALS } from '@/utils/constants';

interface UseJobsOptions {
  driverId?: string;
  status?: JobStatus;
  polling?: boolean;
  pollingInterval?: number;
  /** Called when new jobs are detected during polling */
  onNewJobs?: (newIds: Set<string>) => void;
}

interface UseJobsReturn {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  newJobIds: Set<string>;
  refetch: () => Promise<void>;
  completeJob: (jobId: string) => Promise<boolean>;
  reportIssue: (jobId: string, issueType: string, issueDetail?: string) => Promise<boolean>;
}

/**
 * Custom hook for managing jobs data with optional polling
 */
export function useJobs(options: UseJobsOptions = {}): UseJobsReturn {
  const {
    driverId,
    status,
    polling = false,
    pollingInterval = POLLING_INTERVALS.JOBS,
    onNewJobs,
  } = options;

  const onNewJobsRef = useRef(onNewJobs);
  onNewJobsRef.current = onNewJobs;

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newJobIds, setNewJobIds] = useState<Set<string>>(new Set());

  // Track existing job IDs for detecting new ones
  const existingJobIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const fetchJobs = useCallback(async (isPolling = false) => {
    try {
      // Build query params
      const params = new URLSearchParams();
      if (driverId) params.set('driver_id', driverId);
      if (status) params.set('status', status);

      const url = `${API_ENDPOINTS.JOBS}${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);
      const data: ApiResponse<Job[]> = await response.json();

      if (data.success && data.data) {
        const fetchedJobs = data.data;
        const fetchedJobIds = new Set(fetchedJobs.map(j => j.id));

        // Detect new jobs during polling
        if (isPolling && !isFirstLoadRef.current) {
          const newIds = new Set<string>();
          fetchedJobs.forEach(job => {
            if (!existingJobIdsRef.current.has(job.id)) {
              newIds.add(job.id);
            }
          });

          if (newIds.size > 0) {
            setNewJobIds(prev => new Set([...prev, ...newIds]));
            onNewJobsRef.current?.(newIds);

            // Clear highlight after 5 seconds
            setTimeout(() => {
              setNewJobIds(prev => {
                const updated = new Set(prev);
                newIds.forEach(id => updated.delete(id));
                return updated;
              });
            }, 5000);
          }
        }

        setJobs(fetchedJobs);
        existingJobIdsRef.current = fetchedJobIds;
        isFirstLoadRef.current = false;
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch jobs');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('useJobs error:', err);
    } finally {
      setLoading(false);
    }
  }, [driverId, status]);

  // Initial fetch
  useEffect(() => {
    fetchJobs(false);
  }, [fetchJobs]);

  // Polling
  useEffect(() => {
    if (!polling) return;

    const intervalId = setInterval(() => fetchJobs(true), pollingInterval);
    return () => clearInterval(intervalId);
  }, [polling, pollingInterval, fetchJobs]);

  // Complete a job
  const completeJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.JOBS}/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      });

      const data: ApiResponse<Job> = await response.json();

      if (data.success) {
        // Remove from local state
        setJobs(prev => prev.filter(j => j.id !== jobId));
        return true;
      }

      throw new Error(data.error || 'Failed to complete job');
    } catch (err) {
      console.error('completeJob error:', err);
      return false;
    }
  }, []);

  // Report an issue
  const reportIssue = useCallback(async (
    jobId: string,
    issueType: string,
    issueDetail?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`${API_ENDPOINTS.JOBS}/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'issue',
          issue_type: issueType,
          issue_detail: issueDetail,
        }),
      });

      const data: ApiResponse<Job> = await response.json();

      if (data.success) {
        // Remove from local state
        setJobs(prev => prev.filter(j => j.id !== jobId));
        return true;
      }

      throw new Error(data.error || 'Failed to report issue');
    } catch (err) {
      console.error('reportIssue error:', err);
      return false;
    }
  }, []);

  return {
    jobs,
    loading,
    error,
    newJobIds,
    refetch: () => fetchJobs(false),
    completeJob,
    reportIssue,
  };
}
