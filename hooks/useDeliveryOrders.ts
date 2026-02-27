'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IDeliveryOrder, DOFilter } from '@/types';
import { useDOEvents } from '@/hooks/usePusher';

interface UseDeliveryOrdersResult {
  records: IDeliveryOrder[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  filters: DOFilter;
  setFilters: (filters: DOFilter) => void;
  setPage: (page: number) => void;
  refresh: () => void;
  updateRecord: (id: string, data: Record<string, string>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
}

const defaultFilters: DOFilter = {
  search: '',
  date_from: '', 
  date_to: '',
  destination_branch: '',
  missing_trip_no: false,
};

export function useDeliveryOrders(): UseDeliveryOrdersResult {
  const [records, setRecords] = useState<IDeliveryOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<DOFilter>(defaultFilters);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.date_from) params.set('date_from', filters.date_from);
      if (filters.date_to) params.set('date_to', filters.date_to);
      if (filters.destination_branch) params.set('destination_branch', filters.destination_branch);
      if (filters.missing_trip_no) params.set('missing_trip_no', '1');
      params.set('page', page.toString());
      params.set('limit', '50');

      const res = await fetch(`/api/delivery-orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setRecords(data.data);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        setError(data.error || 'Failed to fetch records');
      }
    } catch {
      setError('Failed to fetch records');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Real-time updates via Pusher
  useDOEvents(fetchRecords);

  const updateRecord = async (id: string, data: Record<string, string>) => {
    try {
      const res = await fetch(`/api/delivery-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        fetchRecords();
      } else {
        setError(result.error || 'Failed to update record');
      }
    } catch {
      setError('Failed to update record');
    }
  };

  const deleteRecord = async (id: string) => {
    try {
      const res = await fetch(`/api/delivery-orders/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
      }
    } catch {
      setError('Failed to delete record');
    }
  };

  return {
    records,
    total,
    page,
    totalPages,
    loading,
    error,
    filters,
    setFilters,
    setPage,
    refresh: fetchRecords,
    updateRecord,
    deleteRecord,
  };
}
