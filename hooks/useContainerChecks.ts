import { useState, useEffect, useCallback } from 'react';
import type { ContainerCheck } from '@/types';

interface UseContainerChecksOptions {
  startDate?: string;
  endDate?: string;
}

interface UseContainerChecksReturn {
  checks: ContainerCheck[];
  loading: boolean;
  refetch: () => Promise<void>;
  markDeparted: (check: ContainerCheck) => Promise<boolean>;
  deleteCheck: (check: ContainerCheck) => Promise<boolean>;
  actionLoading: boolean;
}

export function useContainerChecks({ startDate, endDate }: UseContainerChecksOptions): UseContainerChecksReturn {
  const [checks, setChecks] = useState<ContainerCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/container-check?${params.toString()}`);
      const data = await response.json();
      if (data.success) setChecks(data.data);
    } catch (error) {
      console.error('Error fetching checks:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Re-fetch when page becomes visible (returning from edit page)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refetch]);

  const markDeparted = useCallback(async (check: ContainerCheck): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/container-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: check.id, container_no: check.container_no, status: 'departed' }),
      });
      if (response.ok) {
        await refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error:', error);
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [refetch]);

  const deleteCheck = useCallback(async (check: ContainerCheck): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/container-check?id=${check.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        await refetch();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error:', error);
      return false;
    } finally {
      setActionLoading(false);
    }
  }, [refetch]);

  return { checks, loading, refetch, markDeparted, deleteCheck, actionLoading };
}
