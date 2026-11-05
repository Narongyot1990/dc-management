import { useState, useEffect, useCallback } from 'react';
import type { YardCheck, YardCheckChecklistItem } from '@/types';

interface UseYardChecksOptions {
  startDate?: string;
  endDate?: string;
}

interface UseYardChecksReturn {
  checks: YardCheck[];
  loading: boolean;
  refetch: () => Promise<void>;
  markOut: (check: YardCheck) => Promise<boolean>;
  updateChecklist: (id: string, checklist: YardCheckChecklistItem[], ngDetail?: string) => Promise<boolean>;
  deleteCheck: (check: YardCheck) => Promise<boolean>;
  actionLoading: boolean;
}

export function useYardChecks({ startDate, endDate }: UseYardChecksOptions): UseYardChecksReturn {
  const [checks, setChecks] = useState<YardCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const response = await fetch(`/api/yard-check?${params.toString()}`);
      const data = await response.json();
      if (data.success) setChecks(data.data);
    } catch (error) {
      console.error('Error fetching yard checks:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refetch]);

  const markOut = useCallback(async (check: YardCheck): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/yard-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: check.id, yard_status: 'out' }),
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

  const updateChecklist = useCallback(async (id: string, checklist: YardCheckChecklistItem[], ngDetail?: string): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/yard-check', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, checklist, ng_detail: ngDetail }),
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

  const deleteCheck = useCallback(async (check: YardCheck): Promise<boolean> => {
    setActionLoading(true);
    try {
      const response = await fetch(`/api/yard-check?id=${check.id}`, {
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

  return { checks, loading, refetch, markOut, updateChecklist, deleteCheck, actionLoading };
}
