"use client";

import { useState, useEffect, useCallback } from 'react';
import type { DockOccupancy, ApiResponse, Job } from '@/types';
import { API_ENDPOINTS, DOCKS, POLLING_INTERVALS } from '@/utils/constants';

interface UseDockOccupancyOptions {
  polling?: boolean;
  pollingInterval?: number;
}

interface UseDockOccupancyReturn {
  occupancy: DockOccupancy;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isDockOccupied: (dock: string) => boolean;
  getOccupiedDocks: () => string[];
  getAvailableDocks: () => string[];
}

/**
 * Custom hook for managing dock occupancy data
 */
export function useDockOccupancy(options: UseDockOccupancyOptions = {}): UseDockOccupancyReturn {
  const { polling = false, pollingInterval = POLLING_INTERVALS.DOCKS } = options;

  const [occupancy, setOccupancy] = useState<DockOccupancy>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOccupancy = useCallback(async () => {
    try {
      // Fetch all completed IN jobs to determine dock occupancy
      const response = await fetch(`${API_ENDPOINTS.JOBS}?status=completed`);
      const data: ApiResponse<Job[]> = await response.json();

      if (data.success && data.data) {
        const jobs = data.data;

        // Build occupancy map
        // A dock is occupied if there's a completed IN job and no completed OUT job after it
        const dockMap: DockOccupancy = {};

        // Group jobs by dock_to (for IN jobs)
        const inJobs = jobs
          .filter(j => j.type === 'in' && j.dock_to)
          .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() -
                         new Date(a.completed_at || a.created_at).getTime());

        // Group OUT jobs by dock_from
        const outJobs = jobs
          .filter(j => j.type === 'out' && j.dock_from)
          .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() -
                         new Date(a.completed_at || a.created_at).getTime());

        // For each dock, check if there's a more recent IN than OUT
        DOCKS.forEach(dock => {
          const latestIn = inJobs.find(j => j.dock_to === dock);
          const latestOut = outJobs.find(j => j.dock_from === dock);

          if (latestIn) {
            const inTime = new Date(latestIn.completed_at || latestIn.created_at).getTime();
            const outTime = latestOut
              ? new Date(latestOut.completed_at || latestOut.created_at).getTime()
              : 0;

            // If IN is more recent than OUT, dock is occupied
            if (inTime > outTime) {
              dockMap[dock] = {
                containerNo: latestIn.container_no,
                completedAt: String(latestIn.completed_at || latestIn.created_at),
              };
            }
          }
        });

        setOccupancy(dockMap);
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch dock occupancy');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      console.error('useDockOccupancy error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchOccupancy();
  }, [fetchOccupancy]);

  // Polling
  useEffect(() => {
    if (!polling) return;

    const intervalId = setInterval(fetchOccupancy, pollingInterval);
    return () => clearInterval(intervalId);
  }, [polling, pollingInterval, fetchOccupancy]);

  // Check if a dock is occupied
  const isDockOccupied = useCallback((dock: string): boolean => {
    return !!occupancy[dock];
  }, [occupancy]);

  // Get list of occupied docks
  const getOccupiedDocks = useCallback((): string[] => {
    return Object.keys(occupancy);
  }, [occupancy]);

  // Get list of available docks
  const getAvailableDocks = useCallback((): string[] => {
    return DOCKS.filter(dock => !occupancy[dock]);
  }, [occupancy]);

  return {
    occupancy,
    loading,
    error,
    refetch: fetchOccupancy,
    isDockOccupied,
    getOccupiedDocks,
    getAvailableDocks,
  };
}
